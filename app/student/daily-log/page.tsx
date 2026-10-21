"use client";

import { useAppStore } from "@/lib/store/app-store";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button, Chip, Input, Textarea, Card, CardBody, Select, SelectItem } from "@heroui/react";
import { BookOpen, Calendar, Clock, CheckCircle2, AlertCircle, Trash2, Edit, Upload, FileText, Eye, Download, FileSpreadsheet, Printer, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { canStudentSubmitByInternshipStatus, internshipStatusSubmissionWarning, getMonthKeyLabel } from "@/lib/utils";
import { apiCreateTrainingRecord, apiListTrainingRecords, apiUpdateReview, apiUpdateTrainingRecord, apiUploadFile } from "@/lib/api";
import { downloadHtmlAsDoc, formCDocumentHtml, monthlyReportDocumentHtml, printHtmlDocument } from "@/lib/document-generation";
import type { FormCData, MonthlyReportData } from "@/types";

type WeeklyStatus = "not_submitted" | "submitted" | "certified" | "revision_required";

const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".txt", ".rtf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip",
];

const emptyFormC: FormCData = {
  traineeName: "",
  registrationNumber: "",
  emailAddress: "",
  contactAddress: "",
  contactTelephone: "",
  residentialAddress: "",
  residentialTelephone: "",
  trainingStage: "first_time",
  periodFrom: "",
  periodTo: "",
  trainingEstablishment: "",
  trainingDescription: [{ division: "", durationWeeks: "", natureOfTraining: "", certifyingOfficer: "" }],
  workComments: "",
  conductComments: "",
  attendanceComments: "",
  authorisedLeaveDays: "",
  unauthorisedLeaveDays: "",
  officerInCharge: "",
  officerDesignation: "",
  dateSigned: "",
};

/** Fields a weekly custom filter formula can reference. */
interface WeeklyFilterContext {
  hours: number;
  entries: number;
  status: string;
  week: string;
  index: number;
}

const weeklyFormulaFields = new Set(["hours", "entries", "status", "week", "index"]);

function parseWeeklyFormula(formula: string): { conditions: Array<{ field: string; op: string; value: string }>; error?: string } {
  const parts = formula
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const conditions: Array<{ field: string; op: string; value: string }> = [];
  for (const part of parts) {
    const match = /^([a-zA-Z_]+)\s*(>=|<=|!=|==|=|>|<|contains)\s*(.+)$/i.exec(part);
    if (!match) return { conditions: [], error: `Could not understand "${part}". Use field operator value, e.g. hours>=40 and status=submitted.` };
    const [, rawField, op, value] = match;
    const field = rawField.toLowerCase();
    if (!weeklyFormulaFields.has(field)) return { conditions: [], error: `Unknown field "${rawField}". Allowed fields: hours, entries, status, week, index.` };
    conditions.push({ field, op: op.toLowerCase(), value: value.trim().replace(/^["']|["']$/g, "") });
  }
  return { conditions };
}

function evaluateWeeklyFormula(formula: string, ctx: WeeklyFilterContext): { passes: boolean; error?: string } {
  if (!formula.trim()) return { passes: true };
  const { conditions, error } = parseWeeklyFormula(formula);
  if (error) return { passes: false, error };
  for (const condition of conditions) {
    let matches: boolean;
    if (condition.field === "hours" || condition.field === "entries" || condition.field === "index") {
      const actual = ctx[condition.field];
      const expected = Number(condition.value);
      if (Number.isNaN(expected)) return { passes: false, error: `"${condition.field}" must be compared with a number.` };
      switch (condition.op) {
        case ">": matches = actual > expected; break;
        case ">=": matches = actual >= expected; break;
        case "<": matches = actual < expected; break;
        case "<=": matches = actual <= expected; break;
        case "!=": matches = actual !== expected; break;
        default: matches = actual === expected;
      }
    } else {
      const actual = String(ctx[condition.field as "status" | "week"]).toLowerCase().replace(/_/g, " ");
      const expected = condition.value.toLowerCase().replace(/_/g, " ");
      switch (condition.op) {
        case "!=": matches = actual !== expected; break;
        case "contains": matches = actual.includes(expected); break;
        default: matches = actual === expected;
      }
    }
    if (!matches) return { passes: false };
  }
  return { passes: true };
}

export default function StudentDailyLogPage() {
  const { reviews, submitDailyLog, deleteDailyLog, currentUser, getStudentById, loadRealData } = useAppStore();
  const userId = currentUser?.id ?? "";
  const student = getStudentById(userId);

  const [dateStr, setDateStr] = useState<string>(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - offset * 60 * 1000);
    return localToday.toISOString().split("T")[0];
  });
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "formc" | "monthly" | "cover">("daily");
  const [coverFiles, setCoverFiles] = useState<Record<string, string | null>>({ A: null, B: null, C: null, D: null });
  const [uploadingEntryId, setUploadingEntryId] = useState<string | null>(null);

  // Weekly certification state (real records from the training-monitoring API)
  const [weeklyCertRecords, setWeeklyCertRecords] = useState<Record<string, Record<string, unknown>>>({});
  const [weeklyStatusFilter, setWeeklyStatusFilter] = useState("all");
  const [weeklyFrom, setWeeklyFrom] = useState("");
  const [weeklyTo, setWeeklyTo] = useState("");
  const [weeklyFormula, setWeeklyFormula] = useState("");
  const [replacingWeekKey, setReplacingWeekKey] = useState<string | null>(null);

  // Form C state
  const [formC, setFormC] = useState<FormCData>(emptyFormC);
  const [formCRecord, setFormCRecord] = useState<Record<string, unknown> | null>(null);
  const [showFormCPreview, setShowFormCPreview] = useState(false);
  const [savingFormC, setSavingFormC] = useState(false);

  // Monthly reports state
  const [monthlyRecords, setMonthlyRecords] = useState<Record<string, unknown>[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [showMonthlyPreview, setShowMonthlyPreview] = useState<MonthlyReportData | null>(null);
  const [generatingMonthly, setGeneratingMonthly] = useState(false);

  useEffect(() => {
    loadRealData();
  }, [loadRealData, userId]);

  useEffect(() => {
    if (!userId) return;
    reloadTrainingRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const reloadTrainingRecords = async () => {
    if (!userId) return;
    try {
      const [weeklyResult, formCResult, monthlyResult] = await Promise.all([
        apiListTrainingRecords("weekly_certifications").catch(() => ({ data: [] as Record<string, unknown>[] })),
        apiListTrainingRecords("form_c_submissions").catch(() => ({ data: [] as Record<string, unknown>[] })),
        apiListTrainingRecords("monthly_reports").catch(() => ({ data: [] as Record<string, unknown>[] })),
      ]);
      const weeklyMap: Record<string, Record<string, unknown>> = {};
      weeklyResult.data
        .filter((item) => String(item.student_id) === userId)
        .forEach((item) => {
          const key = String(item.week_start_date ?? "").slice(0, 10);
          if (key) weeklyMap[key] = item;
        });
      setWeeklyCertRecords(weeklyMap);

      const saved = formCResult.data.find((item) => String(item.student_id) === userId) ?? null;
      setFormCRecord(saved);
      if (saved?.form_data && typeof saved.form_data === "object") {
        setFormC((current) => ({ ...current, ...(saved.form_data as Partial<FormCData>) }));
      }

      setMonthlyRecords(monthlyResult.data.filter((item) => String(item.student_id) === userId));
    } catch {
      // Records stay empty when the API is unavailable.
    }
  };

  // Filter logs for the current student that are of type "daily_log"
  const dailyLogs = useMemo(() => {
    return reviews
      .filter((r) => r.studentId === userId && r.type === "daily_log")
      .sort((a, b) => b.title.localeCompare(a.title)); // Sort by date descending
  }, [reviews, userId]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return dailyLogs;
    const q = search.toLowerCase();
    return dailyLogs.filter(
      (log) =>
        log.title.includes(q) ||
        log.content.toLowerCase().includes(q) ||
        (log.feedback && log.feedback.toLowerCase().includes(q))
    );
  }, [dailyLogs, search]);

  const weeklyEntries = useMemo(() => {
    const groups = new Map<string, { start: Date; end: Date; logs: typeof dailyLogs }>();
    dailyLogs.forEach((log) => {
      const date = new Date(`${log.title}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const day = date.getDay();
      const start = new Date(date);
      start.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const key = start.toISOString().slice(0, 10);
      const existing = groups.get(key);
      groups.set(key, { start, end, logs: existing ? [...existing.logs, log] : [log] });
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [dailyLogs]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([new Date().toISOString().slice(0, 7)]);
    dailyLogs.forEach((log) => {
      const month = log.title.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) keys.add(month);
    });
    return Array.from(keys).sort().reverse();
  }, [dailyLogs]);

  const uploadDiaryDocument = async (kind: "A" | "B" | "C" | "D", file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      notifyError("Please upload a PDF or image file.");
      return;
    }
    try {
      await apiUploadFile(file);
      setCoverFiles((current) => ({ ...current, [kind]: file.name }));
      notifySuccess(`${kind === "A" ? "Cover page" : kind === "B" ? "Daily training information" : kind === "C" ? "Weekly certification" : "Performance report"} uploaded.`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to upload document.");
    }
  };

  const isAllowedAttachment = (file: File) => {
    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    const allowedMime =
      file.type.startsWith("image/") ||
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/csv",
        "text/csv",
        "text/plain",
        "application/rtf",
        "application/zip",
        "application/octet-stream",
      ].includes(file.type);
    return allowedMime && ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension);
  };

  /** Attach additional information (Word, PDF, Excel, …) to a daily entry. */
  const uploadEntryAttachment = async (entryId: string, file: File) => {
    if (!isAllowedAttachment(file)) {
      notifyError(`Unsupported file type. Allowed formats: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notifyError("Attachment must be 10MB or smaller.");
      return;
    }
    setUploadingEntryId(entryId);
    try {
      const uploaded = await apiUploadFile(file);
      await apiUpdateReview(entryId, { attachment_url: uploaded.url, attachment_name: file.name });
      await loadRealData();
      notifySuccess("Additional information attached to the daily entry.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to attach the file.");
    } finally {
      setUploadingEntryId(null);
    }
  };

  const removeEntryAttachment = async (entryId: string) => {
    try {
      await apiUpdateReview(entryId, { attachment_url: null, attachment_name: null });
      await loadRealData();
      notifySuccess("Attachment removed.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to remove the attachment.");
    }
  };

  const handleSaveLog = async () => {
    if (!canStudentSubmitByInternshipStatus(student?.internshipStatus)) {
      notifyError(internshipStatusSubmissionWarning);
      return;
    }
    if (!activity.trim()) {
      notifyError("Please describe what you did today.");
      return;
    }
    const hrsVal = parseFloat(hours);
    if (hours && (isNaN(hrsVal) || hrsVal <= 0 || hrsVal > 24)) {
      notifyError("Please enter a valid number of hours (0 - 24).");
      return;
    }

    setSubmitting(true);
    try {
      // Check if entry for this date already exists (when creating a new log)
      if (!editingId && dailyLogs.some((l) => l.title === dateStr)) {
        notifyError(`You already have a log entry for ${dateStr}. Please edit the existing entry instead.`);
        setSubmitting(false);
        return;
      }

      await submitDailyLog({
        id: editingId ?? undefined,
        studentId: userId,
        title: dateStr, // date stored in title field
        content: activity.trim(),
        score: hours ? Math.round(hrsVal) : undefined, // store hours in score field
      });

      notifySuccess(editingId ? "Daily log updated successfully." : "Daily log saved successfully.");
      setActivity("");
      setHours("");
      setEditingId(null);
      await loadRealData();
    } catch (err: any) {
      notifyError(err.message || "Failed to save daily log.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setDateStr(log.title);
    setActivity(log.content);
    setHours(log.score?.toString() ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this log entry?")) return;
    try {
      await deleteDailyLog(id);
      notifySuccess("Daily log entry deleted.");
      await loadRealData();
    } catch (err: any) {
      notifyError(err.message || "Failed to delete entry.");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setActivity("");
    setHours("");
    const today = new Date().toISOString().split("T")[0];
    setDateStr(today);
  };

  // ─── Weekly certification helpers ───────────────────────────────────────────

  const getWeekStatus = (key: string): WeeklyStatus => {
    const record = weeklyCertRecords[key];
    const status = String(record?.status ?? "not_submitted");
    if (status === "submitted" || status === "certified" || status === "revision_required") return status;
    return "not_submitted";
  };

  const submitWeekForCertification = async (key: string, week: { start: Date; end: Date; logs: typeof dailyLogs }, file: File) => {
    if (!canStudentSubmitByInternshipStatus(student?.internshipStatus)) {
      notifyError(internshipStatusSubmissionWarning);
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notifyError("Weekly certifications must be submitted as a signed PDF.");
      return;
    }
    try {
      const uploaded = await apiUploadFile(file);
      await apiCreateTrainingRecord("weekly_certifications", {
        student_id: userId,
        week_start_date: key,
        week_end_date: week.end.toISOString().slice(0, 10),
        daily_log_ids: week.logs.map((log) => log.id),
        file_url: uploaded.url,
        file_name: file.name,
        status: "submitted",
      });
      await reloadTrainingRecords();
      notifySuccess("Weekly certification PDF submitted.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to upload weekly certification PDF.");
    }
  };

  const replaceWeeklyCertification = async (key: string, file: File) => {
    const record = weeklyCertRecords[key];
    if (!record) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notifyError("Weekly certifications must be submitted as a signed PDF.");
      return;
    }
    setReplacingWeekKey(key);
    try {
      const uploaded = await apiUploadFile(file);
      await apiUpdateTrainingRecord("weekly_certifications", String(record.id), {
        file_url: uploaded.url,
        file_name: file.name,
      });
      await reloadTrainingRecords();
      notifySuccess("Weekly certification updated.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to update weekly certification.");
    } finally {
      setReplacingWeekKey(null);
    }
  };

  const weeklyFormulaResult = useMemo(() => {
    if (!weeklyFormula.trim()) return { error: "" as string };
    const { error } = parseWeeklyFormula(weeklyFormula);
    return { error: error ?? "" };
  }, [weeklyFormula]);

  const filteredWeeklyEntries = useMemo(() => {
    return weeklyEntries.filter(([key, week]) => {
      const status = getWeekStatus(key);
      if (weeklyStatusFilter !== "all" && status !== weeklyStatusFilter) return false;
      if (weeklyFrom && key < weeklyFrom) return false;
      if (weeklyTo && key > weeklyTo) return false;
      if (weeklyFormula.trim()) {
        const totalHours = week.logs.reduce((sum, log) => sum + (log.score ?? 0), 0);
        const result = evaluateWeeklyFormula(weeklyFormula, {
          hours: totalHours,
          entries: week.logs.length,
          status,
          week: key,
          index: weeklyEntries.length - weeklyEntries.findIndex(([k]) => k === key),
        });
        if (result.error) return true; // show everything while the formula is invalid
        if (!result.passes) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyEntries, weeklyStatusFilter, weeklyFrom, weeklyTo, weeklyFormula, weeklyCertRecords]);

  // ─── Form C helpers ─────────────────────────────────────────────────────────

  const prefillFormCFromProfile = (data: FormCData): FormCData => ({
    ...data,
    traineeName: data.traineeName || student?.name || currentUser?.name || "",
    registrationNumber: data.registrationNumber || student?.studentId || "",
    emailAddress: data.emailAddress || student?.email || currentUser?.email || "",
    contactTelephone: data.contactTelephone || student?.phone || "",
    trainingEstablishment: data.trainingEstablishment || student?.internshipCompany || "",
    periodFrom: data.periodFrom || student?.internshipStartDate || "",
    periodTo: data.periodTo || student?.internshipEndDate || "",
  });

  const saveFormC = async (status: "draft" | "submitted", extra: Record<string, unknown> = {}) => {
    setSavingFormC(true);
    try {
      await apiCreateTrainingRecord("form_c_submissions", {
        form_data: formC,
        status,
        ...(status === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
        ...extra,
      });
      await reloadTrainingRecords();
      return true;
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save Form C.");
      return false;
    } finally {
      setSavingFormC(false);
    }
  };

  const generateFormC = async () => {
    downloadHtmlAsDoc(formCDocumentHtml(prefillFormCFromProfile(formC)), `Form C - ${student?.name ?? "Trainee"}`);
    await saveFormC("draft");
    notifySuccess("Form C generated. Complete it, get it signed, then upload it back here.");
  };

  const uploadFormCFile = async (file: File) => {
    if (!isAllowedAttachment(file)) {
      notifyError(`Unsupported file type. Allowed formats: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`);
      return;
    }
    try {
      const uploaded = await apiUploadFile(file);
      const ok = await saveFormC("submitted", { file_url: uploaded.url, file_name: file.name });
      if (ok) notifySuccess("Completed Form C uploaded.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to upload Form C.");
    }
  };

  // ─── Monthly report helpers ─────────────────────────────────────────────────

  const buildMonthlyReportData = (monthKey: string): MonthlyReportData => {
    const entries = dailyLogs
      .filter((log) => log.title.slice(0, 7) === monthKey)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((log) => ({ date: log.title, hours: log.score ?? 0, summary: log.content }));
    const [year, month] = monthKey.split("-");
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return {
      studentName: student?.name ?? currentUser?.name ?? "",
      registrationNumber: student?.studentId ?? "",
      program: student?.program ?? "",
      academicYear: student?.academicYear ?? "",
      emailAddress: student?.email ?? currentUser?.email ?? "",
      telephone: student?.phone ?? "",
      trainingEstablishment: student?.internshipCompany ?? "",
      internshipRole: student?.internshipRole ?? "",
      month: getMonthKeyLabel(monthKey),
      periodFrom: `${monthKey}-01`,
      periodTo: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
      entries,
      totalHours: entries.reduce((sum, entry) => sum + entry.hours, 0),
      totalEntries: entries.length,
    };
  };

  const generateMonthlyReport = async () => {
    if (!selectedMonth) return notifyError("Choose a month first.");
    setGeneratingMonthly(true);
    try {
      const reportData = buildMonthlyReportData(selectedMonth);
      await apiCreateTrainingRecord("monthly_reports", {
        month_key: selectedMonth,
        report_data: reportData,
        status: "draft",
      });
      await reloadTrainingRecords();
      setShowMonthlyPreview(reportData);
      notifySuccess(`Monthly report for ${reportData.month} generated from your personal information and daily logs.`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to generate the monthly report.");
    } finally {
      setGeneratingMonthly(false);
    }
  };

  const uploadMonthlyReportFile = async (monthKey: string, file: File) => {
    if (!isAllowedAttachment(file)) {
      notifyError(`Unsupported file type. Allowed formats: ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")}`);
      return;
    }
    try {
      const uploaded = await apiUploadFile(file);
      const existing = monthlyRecords.find((item) => String(item.month_key) === monthKey);
      const reportData = (existing?.report_data as MonthlyReportData | undefined) ?? buildMonthlyReportData(monthKey);
      await apiCreateTrainingRecord("monthly_reports", {
        month_key: monthKey,
        report_data: reportData,
        file_url: uploaded.url,
        file_name: file.name,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      });
      await reloadTrainingRecords();
      notifySuccess("Completed monthly report uploaded.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to upload the monthly report.");
    }
  };

  const monthlyStatusChip = (status: unknown) => {
    const value = String(status ?? "draft");
    return (
      <Chip size="sm" variant="flat" color={value === "submitted" ? "warning" : "default"}>
        {value.replace("_", " ")}
      </Chip>
    );
  };

  const tabs: Array<["daily" | "weekly" | "formc" | "monthly" | "cover", string]> = [
    ["daily", "Daily Entries"],
    ["weekly", "Weekly Certification"],
    ["formc", "Form C"],
    ["monthly", "Monthly Reports"],
    ["cover", "Daily Log Book documents"],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header section */}
      <div className="rounded-card border border-border/60 bg-white p-4 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-button bg-primary/10 p-2.5 text-primary">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="ds-page-title">Daily Log Book</h1>
            <p className="ds-page-description">
              Write a daily diary entry documenting your internship work, tasks, and reflections.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-surface-muted p-1">
        {tabs.map(([key, label]) => (
          <Button key={key} variant={activeTab === key ? "solid" : "light"} color={activeTab === key ? "primary" : "default"} radius="lg" onPress={() => setActiveTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {activeTab === "daily" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Diary entry form */}
          <div className="lg:col-span-1">
            <Card className="border border-border/60 bg-white shadow-card" radius="lg">
              <CardBody className="space-y-4 p-5">
                <h2 className="text-lg font-bold text-text-primary">
                  {editingId ? "Edit Diary Entry" : "Write Today's Diary"}
                </h2>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Log Date
                  </label>
                  <Input
                    type="date"
                    value={dateStr}
                    onValueChange={setDateStr}
                    isDisabled={!!editingId}
                    variant="bordered"
                    radius="lg"
                    startContent={<Calendar size={16} className="text-text-secondary" />}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Hours Worked
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 8"
                    value={hours}
                    onValueChange={setHours}
                    variant="bordered"
                    radius="lg"
                    startContent={<Clock size={16} className="text-text-secondary" />}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    What did you do?
                  </label>
                  <Textarea
                    placeholder="Describe your daily activities, achievements, or challenges..."
                    value={activity}
                    onValueChange={setActivity}
                    variant="bordered"
                    radius="lg"
                    minRows={6}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    color="primary"
                    radius="lg"
                    className="flex-1 font-semibold"
                    isLoading={submitting}
                    onPress={handleSaveLog}
                  >
                    {editingId ? "Update Entry" : "Save Entry"}
                  </Button>
                  {editingId && (
                    <Button variant="flat" radius="lg" onPress={handleCancelEdit}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Diary entries list */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-card border border-border/60 bg-white p-4 shadow-card flex items-center justify-between gap-4">
              <Input
                placeholder="Search diary entries..."
                value={search}
                onValueChange={setSearch}
                variant="bordered"
                radius="lg"
                className="max-w-xs"
              />
              <div className="text-sm text-text-secondary">
                Total: <span className="font-semibold text-primary">{dailyLogs.length} entries</span>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="rounded-card border border-border/60 bg-white p-12 text-center shadow-card">
                <BookOpen size={48} className="mx-auto text-text-secondary/40 mb-3" />
                <p className="font-medium text-text-primary">No diary entries found</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {search ? "Try adjusting your search query." : "Start writing your first entry on the left!"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLogs.map((log) => {
                  const isViewed = log.status === "approved";
                  return (
                    <Card key={log.id} className="border border-border/60 bg-white shadow-sm hover:shadow-card transition-all" radius="lg">
                      <CardBody className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-text-primary flex items-center gap-1.5">
                              <Calendar size={16} className="text-primary" />
                              {log.title}
                            </span>
                            {log.score ? (
                              <Chip size="sm" variant="flat" color="secondary" startContent={<Clock size={12} />}>
                                {log.score} hrs
                              </Chip>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {isViewed ? (
                              <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 size={14} />}>
                                Viewed by Supervisor
                              </Chip>
                            ) : (
                              <Chip size="sm" color="warning" variant="flat" startContent={<AlertCircle size={14} />}>
                                Unviewed
                              </Chip>
                            )}
                            {!isViewed && (
                              <div className="flex gap-1">
                                <Button size="sm" variant="flat" isIconOnly radius="md" onPress={() => handleEdit(log)} title="Edit Entry">
                                  <Edit size={14} className="text-text-secondary" />
                                </Button>
                                <Button size="sm" variant="flat" color="danger" isIconOnly radius="md" onPress={() => handleDelete(log.id)} title="Delete Entry">
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                          {log.content}
                        </p>

                        {log.feedback && (
                          <div className="mt-2 rounded-button bg-surface-muted border border-border/50 p-3">
                            <p className="text-xs font-semibold text-text-secondary uppercase">
                              Supervisor Feedback
                            </p>
                            <p className="mt-1 text-sm text-text-primary leading-relaxed">
                              {log.feedback}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                          {log.attachmentUrl ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                                <FileText size={13} /> {log.attachmentName}
                              </span>
                              <a href={log.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline">
                                <Eye size={13} /> View
                              </a>
                              <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-medium text-text-primary">
                                <Upload size={13} className="mr-1.5" /> Replace
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) void uploadEntryAttachment(log.id, file);
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              <Button
                                size="sm"
                                variant="flat"
                                color="danger"
                                radius="md"
                                onPress={() => void removeEntryAttachment(log.id)}
                                title="Remove attachment"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </>
                          ) : (
                            <label
                              className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-60"
                              title="Attach additional information (Word, PDF, Excel…)"
                            >
                              <Upload size={14} className="mr-1.5" />
                              {uploadingEntryId === log.id ? "Uploading…" : "Add information"}
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,image/*,.zip"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void uploadEntryAttachment(log.id, file);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "weekly" && (
        <div className="space-y-4">
          {/* Filters + custom filtering formula */}
          <div className="grid grid-cols-1 gap-3 rounded-card border border-border/60 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Status"
              selectedKeys={[weeklyStatusFilter]}
              onSelectionChange={(keys) => setWeeklyStatusFilter(String(Array.from(keys)[0] ?? "all"))}
              variant="bordered"
              radius="lg"
              aria-label="Weekly status filter"
            >
              <SelectItem key="all">All Statuses</SelectItem>
              <SelectItem key="not_submitted">Not Submitted</SelectItem>
              <SelectItem key="submitted">Submitted</SelectItem>
              <SelectItem key="certified">Certified</SelectItem>
              <SelectItem key="revision_required">Revision Required</SelectItem>
            </Select>
            <Input type="date" label="Week starting from" value={weeklyFrom} onValueChange={setWeeklyFrom} variant="bordered" radius="lg" />
            <Input type="date" label="Week starting up to" value={weeklyTo} onValueChange={setWeeklyTo} variant="bordered" radius="lg" />
            <Input
              label="Custom filtering formula"
              placeholder="e.g. hours>=40 and entries>=5"
              value={weeklyFormula}
              onValueChange={setWeeklyFormula}
              variant="bordered"
              radius="lg"
              isInvalid={!!weeklyFormulaResult.error}
              errorMessage={weeklyFormulaResult.error}
              description="Fields: hours, entries, status, week, index"
            />
          </div>

          {weeklyEntries.length === 0 ? (
            <Card>
              <CardBody className="p-8 text-center text-sm text-text-secondary">Add daily entries to create weekly certification periods.</CardBody>
            </Card>
          ) : (
            filteredWeeklyEntries.map(([key, week], index) => {
              const status = getWeekStatus(key);
              const record = weeklyCertRecords[key];
              const totalHours = week.logs.reduce((sum, log) => sum + (log.score ?? 0), 0);
              const editable = status === "submitted" || status === "revision_required";
              return (
                <Card key={key} className="border border-border/60 bg-white" radius="lg">
                  <CardBody className="space-y-4 p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <h2 className="font-semibold">
                          Week {weeklyEntries.length - index}: {week.start.toLocaleDateString()} – {week.end.toLocaleDateString()}
                        </h2>
                        <p className="text-sm text-text-secondary">
                          {week.logs.length} daily entr{week.logs.length === 1 ? "y" : "ies"} · {totalHours} hrs recorded
                        </p>
                      </div>
                      <Chip
                        color={status === "certified" ? "success" : status === "revision_required" ? "danger" : status === "submitted" ? "warning" : "default"}
                        variant="flat"
                      >
                        {status.replace("_", " ")}
                      </Chip>
                    </div>

                    {record?.external_supervisor_feedback ? (
                      <p className="rounded-lg bg-surface-muted p-3 text-sm">
                        External supervisor remarks: {String(record.external_supervisor_feedback)}
                      </p>
                    ) : null}

                    {record?.file_url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={String(record.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                          <FileText size={14} /> {String(record.file_name ?? "Weekly certification PDF")}
                        </a>
                      </div>
                    ) : null}

                    {editable && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 p-3">
                        <p className="text-sm text-text-secondary">Submitted — you can still edit this certification by replacing the PDF.</p>
                        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-60">
                          <Upload size={15} className="mr-2" />
                          {replacingWeekKey === key ? "Uploading…" : "Edit / replace PDF"}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void replaceWeeklyCertification(key, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {status === "certified" && (
                      <p className="text-xs text-success">This week has been certified by your external supervisor and is locked.</p>
                    )}
                  </CardBody>
                </Card>
              );
            })
          )}

          {/* Submission cards for weeks that have not been submitted yet */}
          {weeklyEntries
            .filter(([key]) => getWeekStatus(key) === "not_submitted")
            .map(([key, week], index) => (
              <Card key={`upload-${key}`} className="border border-border/60 bg-white" radius="lg">
                <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Week {weeklyEntries.length - index}: signed weekly certification</p>
                    <p className="text-sm text-text-secondary">
                      Upload the completed weekly certification PDF for {week.start.toLocaleDateString()} – {week.end.toLocaleDateString()}.
                    </p>
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
                    <Upload size={15} className="mr-2" /> Submit week for certification
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void submitWeekForCertification(key, week, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </CardBody>
              </Card>
            ))}
        </div>
      )}

      {activeTab === "formc" && (
        <div className="space-y-4">
          <Card className="border border-border/60 bg-white" radius="lg">
            <CardBody className="space-y-5 p-5">
              <div>
                <h2 className="text-lg font-semibold">Form C – Details of Industrial Training Completed</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Fill in the necessary information, extract (download) the form, get it signed and stamped, then upload it back here.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="1. Name of Trainee" value={formC.traineeName} onValueChange={(v) => setFormC((f) => ({ ...f, traineeName: v }))} variant="bordered" radius="lg" />
                <Input label="2. University Registration Number" value={formC.registrationNumber} onValueChange={(v) => setFormC((f) => ({ ...f, registrationNumber: v }))} variant="bordered" radius="lg" />
                <Input label="3. E-mail Address" type="email" value={formC.emailAddress} onValueChange={(v) => setFormC((f) => ({ ...f, emailAddress: v }))} variant="bordered" radius="lg" />
                <Input label="4. Contact Telephone" value={formC.contactTelephone} onValueChange={(v) => setFormC((f) => ({ ...f, contactTelephone: v }))} variant="bordered" radius="lg" />
                <Input label="4. Contact Address" value={formC.contactAddress} onValueChange={(v) => setFormC((f) => ({ ...f, contactAddress: v }))} variant="bordered" radius="lg" className="md:col-span-2" />
                <Input label="4. Residential Telephone" value={formC.residentialTelephone} onValueChange={(v) => setFormC((f) => ({ ...f, residentialTelephone: v }))} variant="bordered" radius="lg" />
                <Input label="4. Residential Address" value={formC.residentialAddress} onValueChange={(v) => setFormC((f) => ({ ...f, residentialAddress: v }))} variant="bordered" radius="lg" />
                <Select
                  label="5. Training Stage"
                  selectedKeys={[formC.trainingStage]}
                  onSelectionChange={(keys) => setFormC((f) => ({ ...f, trainingStage: String(Array.from(keys)[0] ?? "first_time") as FormCData["trainingStage"] }))}
                  variant="bordered"
                  radius="lg"
                >
                  <SelectItem key="first_time">First time</SelectItem>
                  <SelectItem key="repeat">Repeat</SelectItem>
                </Select>
                <Input label="7. Name of Training Establishment" value={formC.trainingEstablishment} onValueChange={(v) => setFormC((f) => ({ ...f, trainingEstablishment: v }))} variant="bordered" radius="lg" />
                <Input label="6. Period of Training – From" type="date" value={formC.periodFrom} onValueChange={(v) => setFormC((f) => ({ ...f, periodFrom: v }))} variant="bordered" radius="lg" />
                <Input label="6. Period of Training – To" type="date" value={formC.periodTo} onValueChange={(v) => setFormC((f) => ({ ...f, periodTo: v }))} variant="bordered" radius="lg" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-text-primary">8. Description of Training Received</p>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Plus size={14} />}
                    onPress={() => setFormC((f) => ({ ...f, trainingDescription: [...f.trainingDescription, { division: "", durationWeeks: "", natureOfTraining: "", certifyingOfficer: "" }] }))}
                  >
                    Add row
                  </Button>
                </div>
                <div className="space-y-3">
                  {formC.trainingDescription.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid grid-cols-1 gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Input label="Division / Workshop / Site" value={row.division} onValueChange={(v) => setFormC((f) => ({ ...f, trainingDescription: f.trainingDescription.map((item, i) => (i === rowIndex ? { ...item, division: v } : item)) }))} variant="bordered" radius="lg" />
                      <Input label="Duration (weeks)" type="number" min={0} value={row.durationWeeks} onValueChange={(v) => setFormC((f) => ({ ...f, trainingDescription: f.trainingDescription.map((item, i) => (i === rowIndex ? { ...item, durationWeeks: v } : item)) }))} variant="bordered" radius="lg" />
                      <Input label="Nature of Training" value={row.natureOfTraining} onValueChange={(v) => setFormC((f) => ({ ...f, trainingDescription: f.trainingDescription.map((item, i) => (i === rowIndex ? { ...item, natureOfTraining: v } : item)) }))} variant="bordered" radius="lg" />
                      <Input label="Certifying Officer" value={row.certifyingOfficer} onValueChange={(v) => setFormC((f) => ({ ...f, trainingDescription: f.trainingDescription.map((item, i) => (i === rowIndex ? { ...item, certifyingOfficer: v } : item)) }))} variant="bordered" radius="lg" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Textarea label="9. Comments on Trainee's Work" value={formC.workComments} onValueChange={(v) => setFormC((f) => ({ ...f, workComments: v }))} variant="bordered" minRows={2} />
                <Textarea label="9. Comments on Trainee's Conduct" value={formC.conductComments} onValueChange={(v) => setFormC((f) => ({ ...f, conductComments: v }))} variant="bordered" minRows={2} />
                <Textarea label="9. Comments on Trainee's Attendance" value={formC.attendanceComments} onValueChange={(v) => setFormC((f) => ({ ...f, attendanceComments: v }))} variant="bordered" minRows={2} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Authorised leave days" type="number" min={0} value={formC.authorisedLeaveDays} onValueChange={(v) => setFormC((f) => ({ ...f, authorisedLeaveDays: v }))} variant="bordered" radius="lg" />
                  <Input label="Unauthorised leave days" type="number" min={0} value={formC.unauthorisedLeaveDays} onValueChange={(v) => setFormC((f) => ({ ...f, unauthorisedLeaveDays: v }))} variant="bordered" radius="lg" />
                </div>
                <Input label="10. Officer in Charge (name)" value={formC.officerInCharge} onValueChange={(v) => setFormC((f) => ({ ...f, officerInCharge: v }))} variant="bordered" radius="lg" />
                <Input label="10. Officer Designation" value={formC.officerDesignation} onValueChange={(v) => setFormC((f) => ({ ...f, officerDesignation: v }))} variant="bordered" radius="lg" />
                <Input label="10. Date Signed" type="date" value={formC.dateSigned} onValueChange={(v) => setFormC((f) => ({ ...f, dateSigned: v }))} variant="bordered" radius="lg" />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button color="primary" radius="lg" startContent={<Download size={16} />} isLoading={savingFormC} onPress={() => void generateFormC()}>
                  Generate &amp; extract Form C
                </Button>
                <Button variant="flat" radius="lg" startContent={<Eye size={16} />} onPress={() => setShowFormCPreview(true)}>
                  View form
                </Button>
                <Button
                  variant="flat"
                  radius="lg"
                  startContent={<Printer size={16} />}
                  onPress={() => printHtmlDocument(formCDocumentHtml(prefillFormCFromProfile(formC)))}
                >
                  Print / save as PDF
                </Button>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-text-primary">
                  <Upload size={15} className="mr-2" /> Upload completed Form C
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,image/*,.zip"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadFormCFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              {formCRecord?.file_url ? (
                <div className="rounded-xl border border-border/60 bg-surface-muted p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-text-primary">Uploaded Form C</p>
                      <p className="text-xs text-text-secondary">{String(formCRecord.file_name ?? "")}</p>
                    </div>
                    {monthlyStatusChip(formCRecord.status)}
                    <a href={String(formCRecord.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                      <Eye size={14} /> View uploaded form
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-secondary">
                  Tip: the generated file downloads as a Word document — complete it, collect the certifying officer's signature and the official seal, then upload it back (PDF, Word or Excel).
                </p>
              )}
            </CardBody>
          </Card>

          {showFormCPreview && (
            <Card className="border border-border/60 bg-white" radius="lg">
              <CardBody className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Form C preview</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="flat" startContent={<Printer size={14} />} onPress={() => printHtmlDocument(formCDocumentHtml(prefillFormCFromProfile(formC)))}>
                      Print
                    </Button>
                    <Button size="sm" variant="flat" color="danger" onPress={() => setShowFormCPreview(false)}>
                      Close
                    </Button>
                  </div>
                </div>
                <iframe
                  title="Form C preview"
                  srcDoc={formCDocumentHtml(prefillFormCFromProfile(formC))}
                  className="h-[600px] w-full rounded-lg border border-border/60 bg-white"
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="space-y-4">
          <Card className="border border-border/60 bg-white" radius="lg">
            <CardBody className="space-y-4 p-5">
              <div>
                <h2 className="text-lg font-semibold">Monthly Reports</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Generate a monthly report from your personal information and daily logbook entries, then view, download and upload the completed report.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_auto] sm:items-end">
                <Select
                  label="Filter by month"
                  selectedKeys={[selectedMonth]}
                  onSelectionChange={(keys) => setSelectedMonth(String(Array.from(keys)[0] ?? ""))}
                  variant="bordered"
                  radius="lg"
                  aria-label="Month filter"
                >
                  {monthOptions.map((month) => (
                    <SelectItem key={month}>{getMonthKeyLabel(month)}</SelectItem>
                  ))}
                </Select>
                <Button color="primary" radius="lg" startContent={<FileText size={16} />} isLoading={generatingMonthly} onPress={() => void generateMonthlyReport()}>
                  Generate Monthly Report
                </Button>
              </div>
            </CardBody>
          </Card>

          {monthlyRecords.length === 0 ? (
            <Card>
              <CardBody className="p-8 text-center text-sm text-text-secondary">
                No monthly reports yet. Pick a month above and press “Generate Monthly Report”.
              </CardBody>
            </Card>
          ) : (
            monthlyRecords
              .slice()
              .sort((a, b) => String(b.month_key).localeCompare(String(a.month_key)))
              .map((record) => {
                const monthKey = String(record.month_key);
                const reportData = record.report_data as MonthlyReportData | undefined;
                return (
                  <Card key={String(record.id)} className="border border-border/60 bg-white" radius="lg">
                    <CardBody className="space-y-3 p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold">{getMonthKeyLabel(monthKey)}</p>
                          <p className="text-sm text-text-secondary">
                            {reportData ? `${reportData.totalEntries} entries · ${reportData.totalHours} hrs · ${reportData.trainingEstablishment || "No establishment recorded"}` : String(record.file_name ?? "")}
                          </p>
                        </div>
                        {monthlyStatusChip(record.status)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Eye size={14} />}
                          onPress={() => setShowMonthlyPreview(reportData ?? buildMonthlyReportData(monthKey))}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Download size={14} />}
                          onPress={() => downloadHtmlAsDoc(monthlyReportDocumentHtml(reportData ?? buildMonthlyReportData(monthKey)), `Monthly Report ${monthKey}`)}
                        >
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Printer size={14} />}
                          onPress={() => printHtmlDocument(monthlyReportDocumentHtml(reportData ?? buildMonthlyReportData(monthKey)))}
                        >
                          Print / save as PDF
                        </Button>
                        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-4 text-xs font-semibold text-white">
                          <Upload size={14} className="mr-1.5" /> Upload completed report
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,image/*,.zip"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) void uploadMonthlyReportFile(monthKey, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {record.file_url ? (
                        <a href={String(record.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                          <FileSpreadsheet size={14} /> {String(record.file_name ?? "Uploaded report")}
                        </a>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })
          )}

          {showMonthlyPreview && (
            <Card className="border border-border/60 bg-white" radius="lg">
              <CardBody className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{showMonthlyPreview.month} – preview</h3>
                  <Button size="sm" variant="flat" color="danger" onPress={() => setShowMonthlyPreview(null)}>
                    Close
                  </Button>
                </div>
                <iframe
                  title="Monthly report preview"
                  srcDoc={monthlyReportDocumentHtml(showMonthlyPreview)}
                  className="h-[600px] w-full rounded-lg border border-border/60 bg-white"
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {activeTab === "cover" && (
        <div className="space-y-4">
          <Card className="border border-border/60 bg-white" radius="lg">
            <CardBody className="space-y-4 p-5">
              <h2 className="text-lg font-semibold">Daily Log Book documents</h2>
              <p className="text-sm text-text-secondary">
                Cover pages are uploaded against their individual daily entries. Upload the completed and signed performance report here when required.
              </p>
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">Progress Report on Industrial Trainee Performance</p>
                  {coverFiles.D && <p className="mt-1 text-xs text-success">Uploaded: {coverFiles.D}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" color="danger" isDisabled={!coverFiles.D} onPress={() => setCoverFiles((current) => ({ ...current, D: null }))}>
                    Delete
                  </Button>
                  <label className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
                    <Upload size={15} className="mr-2" /> {coverFiles.D ? "Replace" : "Upload PDF/image"}
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadDiaryDocument("D", file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
