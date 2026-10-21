"use client";

import { AppModal } from "@/components/ui/app-modal";
import { PdfViewer } from "@/components/reports/pdf-viewer";
import { ReportStatusBadge } from "@/components/reports/report-status-badge";
import { useAppStore } from "@/lib/store/app-store";
import { apiUploadFile, apiCreateLogbookReport, apiDeleteLogbookReport, apiListTrainingRecords } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  canStudentSubmitByInternshipStatus,
  formatDate,
  getFortnightLabel,
  getFortnightOf,
  internshipStatusSubmissionWarning,
  isValidReportPeriod,
  MAX_UPLOAD_BYTES,
} from "@/lib/utils";
import type { LogbookReport } from "@/types";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const statusFilterOptions: { key: string; label: string }[] = [
  { key: "all", label: "All Statuses" },
  { key: "pending", label: "Pending" },
  { key: "unreviewed", label: "Unreviewed" },
  { key: "reviewed", label: "Reviewed" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

function periodToMonthKey(period: string): string {
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const parts = period.trim().toLowerCase().split(/\s+/);
  if (parts.length >= 2) {
    const mon = months[parts[0].slice(0, 3)] ?? "01";
    const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
    return `${year}-${mon}`;
  }
  return period.trim();
}

export default function StudentReportsPage() {
  const { getReportsForStudent, submitLogbookReport, deleteLogbookReport, getStudentById, currentUser, loadRealData } = useAppStore();
  const userId = currentUser?.id ?? "";
  const student = getStudentById(userId);
  const reports = getReportsForStudent(userId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fortnightFilter, setFortnightFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newReport, setNewReport] = useState({ period: "", excerpt: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"fortnightly" | "monthly" | "assessment">("fortnightly");
  const [monthlyFile, setMonthlyFile] = useState<File | null>(null);
  const [monthlySubmission, setMonthlySubmission] = useState<{ date: string; fileName: string; status: "pending" | "reviewed" | "accepted" | "rejected"; marks?: number; feedback?: string } | null>(null);
  const [evaluation, setEvaluation] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interim reports are filtered per fortnight (two reporting periods per
  // month: 1st–15th and 16th–month end) instead of per calendar month.
  const fortnightOptions = useMemo(() => {
    const keys = Array.from(
      new Set(reports.map((r) => getFortnightOf(r.submittedAt)?.key).filter(Boolean) as string[])
    ).sort().reverse();
    return [
      { key: "all", label: "All Fortnights" },
      ...keys.map((k) => ({ key: k, label: getFortnightLabel(k) })),
    ];
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const fortnightKey = getFortnightOf(r.submittedAt)?.key ?? "";
      const matchesFortnight = fortnightFilter === "all" || fortnightKey === fortnightFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesFortnight && matchesStatus;
    });
  }, [reports, fortnightFilter, statusFilter]);

  const detailReport = reports.find((r) => r.id === selectedId) ?? null;
  const completed = reports.filter((r) => r.status === "accepted" || r.status === "reviewed").length;

  useEffect(() => {
    loadRealData();
    if (userId) {
      apiListTrainingRecords("evaluation_records")
        .then((result) => setEvaluation(result.data.find((item) => String(item.student_id) === userId && Boolean(item.published)) ?? null))
        .catch(() => {});
    }
  }, [loadRealData, userId]);

  const handleSubmitReport = async () => {
    if (!userId || !student) {
      notifyError("Your student profile is still loading. Please refresh and try again.");
      return;
    }
    if (!canStudentSubmitByInternshipStatus(student.internshipStatus)) {
      notifyError(internshipStatusSubmissionWarning);
      return;
    }
    if (!newReport.period.trim() || !newReport.excerpt.trim()) {
      notifyError("Please fill in the report name and summary.");
      return;
    }
    if (!isValidReportPeriod(newReport.period)) {
      notifyError("Please enter a report name.");
      return;
    }
    if (pdfFile) {
      if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
        notifyError("Only PDF files are allowed for logbook reports.");
        return;
      }
      if (pdfFile.size > MAX_UPLOAD_BYTES) {
        notifyError("Report PDF must be 10MB or smaller.");
        return;
      }
    }
    const monthKey = periodToMonthKey(newReport.period);
    setSubmitting(true);
    try {
      // 1. Upload PDF to Supabase storage if provided
      let pdfUrl = "";
      let pdfFileName = "";
      if (pdfFile) {
        const uploadResult = await apiUploadFile(pdfFile);
        pdfUrl = uploadResult.url;
        pdfFileName = pdfFile.name;
      }
      const nextMonthNumber =
        Math.max(...reports.map((r) => r.monthNumber), 0) + 1;

      // 2. Save report record to DB
      const result = await apiCreateLogbookReport({
        student_id: userId,
        student_name: currentUser?.name ?? student?.name ?? "",
        supervisor_id: student?.supervisorId ?? null,
        month_number: nextMonthNumber,
        period: newReport.period.trim(),
        month_key: monthKey,
        excerpt: newReport.excerpt.trim(),
        ...(pdfUrl
          ? { pdf_url: pdfUrl, pdf_file_name: pdfFileName }
          : {}),
        status: "pending",
        submitted_at: new Date().toISOString(),
        is_current: true,
        report_type: "fortnightly",
      });

      const dbId = (result.data as Record<string, unknown>)?.id as string | undefined;

      // 3. Update in-memory store with real ID and URL
      submitLogbookReport({
        id: dbId,
        studentId: userId,
        period: newReport.period,
        excerpt: newReport.excerpt,
        pdfUrl,
        pdfFileName,
      });
      setShowAdd(false);
      setNewReport({ period: "", excerpt: "" });
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadRealData();
      notifySuccess("Fortnightly report and PDF submitted successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      notifyError("Failed to submit report: " + msg);
    } finally {
      setSubmitting(false);
    }
  };
  const submitMonthlyReport = async () => {
    if (!monthlyFile) return notifyError("Please select the monthly progress report PDF.");
    if (monthlyFile.type !== "application/pdf" && !monthlyFile.name.toLowerCase().endsWith(".pdf")) return notifyError("Only PDF files are allowed.");
    try {
      const uploaded = await apiUploadFile(monthlyFile);
      const result = await apiCreateLogbookReport({
        student_id: userId,
        student_name: currentUser?.name ?? student?.name ?? "",
        supervisor_id: student?.supervisorId ?? null,
        period: `Monthly Progress Report ${new Date().toISOString().slice(0, 7)}`,
        excerpt: "Monthly progress report PDF submission",
        pdf_url: uploaded.url,
        pdf_file_name: monthlyFile.name,
        report_type: "monthly",
        status: "pending",
        submitted_at: new Date().toISOString(),
        is_current: true,
      });
      const saved = result.data as Record<string, unknown>;
      setMonthlySubmission({ date: String(saved.submitted_at ?? new Date().toISOString()), fileName: monthlyFile.name, status: "pending" });
      setMonthlyFile(null);
      await loadRealData();
      notifySuccess("Monthly progress report submitted successfully.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to submit monthly progress report.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-card border border-border/60 bg-white p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="ds-page-title">Reports</h1>
            <p className="ds-page-description">
              Submit fortnightly reports and track supervisor reviews.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-card border border-border/60 bg-surface-muted px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Progress
              </p>
              <p className="mt-1 text-xl font-bold text-primary">
                {completed} Reports
              </p>
            </div>
            <div className="rounded-card border border-border/60 bg-surface-muted px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                Total Marks
              </p>
              <p className="mt-1 text-xl font-bold text-primary">
                {reports.reduce((sum, r) => sum + (r.marks ?? 0), 0)} points
              </p>
            </div>
            <Button
              color="primary"
              radius="lg"
              className="font-semibold"
              startContent={<Plus size={18} />}
              isDisabled={!userId || !student}
              onPress={() => setShowAdd(true)}
            >
              Add Report
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border/60 bg-surface-muted p-1">
        <Button variant={activeTab === "fortnightly" ? "solid" : "light"} color={activeTab === "fortnightly" ? "primary" : "default"} radius="lg" onPress={() => setActiveTab("fortnightly")}>Fortnightly Interim Report</Button>
        <Button variant={activeTab === "monthly" ? "solid" : "light"} color={activeTab === "monthly" ? "primary" : "default"} radius="lg" onPress={() => setActiveTab("monthly")}>Monthly Progress Report</Button>
        <Button variant={activeTab === "assessment" ? "solid" : "light"} color={activeTab === "assessment" ? "primary" : "default"} radius="lg" onPress={() => setActiveTab("assessment")}>Assessment &amp; Results</Button>
      </div>

      {activeTab === "fortnightly" && <>
      <div className="grid grid-cols-1 gap-3 rounded-card border border-border/60 bg-white p-4 shadow-card sm:grid-cols-2">
        <Select
          label="Filter by Fortnight"
          selectedKeys={[fortnightFilter]}
          onSelectionChange={(keys) => setFortnightFilter((Array.from(keys)[0] as string) ?? "all")}
          variant="bordered"
          radius="lg"
          aria-label="Fortnight filter"
          description="Interim reports are filtered twice per month (1st–15th and 16th–month end)."
        >
          {fortnightOptions.map((opt) => (
            <SelectItem key={opt.key}>{opt.label}</SelectItem>
          ))}
        </Select>
        <Select
          label="Filter by Status"
          selectedKeys={[statusFilter]}
          onSelectionChange={(keys) => setStatusFilter((Array.from(keys)[0] as string) ?? "all")}
          variant="bordered"
          radius="lg"
          aria-label="Status filter"
        >
          {statusFilterOptions.map((opt) => (
            <SelectItem key={opt.key}>{opt.label}</SelectItem>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-card border border-border/60 bg-white p-10 text-center shadow-card">
          <p className="font-medium text-text-primary">No reports match your filters</p>
          <p className="mt-1 text-sm text-text-secondary">
            Submit a new report or adjust filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onView={() => setSelectedId(report.id)}
              onDelete={async () => {
                try { await apiDeleteLogbookReport(report.id); } catch { /* not in DB yet */ }
                deleteLogbookReport(report.id);
                await loadRealData();
              }}
            />
          ))}
        </div>
      )}

      <AppModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Submit Fortnightly Report"
        size="2xl"
        footer={
          <>
            <Button variant="light" onPress={() => setShowAdd(false)}>Cancel</Button>
            <Button
              color="primary"
              isLoading={submitting}
              isDisabled={!userId || !student || !newReport.period.trim() || !newReport.excerpt.trim()}
              onPress={handleSubmitReport}
            >
              Submit Report
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Report Name"
            placeholder="Fortnight Report 1"
            value={newReport.period}
            onValueChange={(v) => setNewReport((f) => ({ ...f, period: v }))}
            variant="bordered"
            radius="lg"
            isInvalid={!!newReport.period && !isValidReportPeriod(newReport.period)}
            errorMessage="Please enter a report name."
          />
          <Textarea
            label="Report Summary"
            placeholder="Brief Summary of Your Activities During the Past Two Weeks"
            value={newReport.excerpt}
            onValueChange={(v) => setNewReport((f) => ({ ...f, excerpt: v }))}
            variant="bordered"
            radius="lg"
            minRows={4}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Report PDF (if required)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
                  notifyError("Only PDF files are allowed.");
                  e.target.value = "";
                  return;
                }
                if (file && file.size > MAX_UPLOAD_BYTES) {
                  notifyError("Report PDF must be 10MB or smaller.");
                  e.target.value = "";
                  return;
                }
                setPdfFile(file);
              }}
            />
            {pdfFile ? (
              <div className="flex flex-col gap-2 rounded-button border border-border bg-surface-muted p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <FileText size={16} className="text-primary" />
                  {pdfFile.name}
                </span>
                <Button size="sm" variant="flat" onPress={() => fileInputRef.current?.click()}>
                  Replace PDF
                </Button>
              </div>
            ) : (
              <Button
                variant="bordered"
                radius="lg"
                className="w-full border-dashed"
                startContent={<Upload size={16} />}
                onPress={() => fileInputRef.current?.click()}
              >
                Upload PDF Report
              </Button>
            )}
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={!!detailReport}
        onClose={() => setSelectedId(null)}
        title={detailReport ? `Fortnightly Report #${detailReport.monthNumber}` : "Report Details"}
        size="3xl"
        footer={
          <Button variant="light" onPress={() => setSelectedId(null)}>Close</Button>
        }
      >
        {detailReport && <ReportDetail report={detailReport} />}
      </AppModal>
      </>}

      {activeTab === "monthly" && <div className="rounded-card border border-border/60 bg-white p-5 shadow-card"><h2 className="text-lg font-semibold">Monthly Progress Report</h2><p className="mt-1 text-sm text-text-secondary">Upload your completed monthly progress report as a PDF.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-text-primary"><Upload size={16} className="mr-2" /> {monthlyFile ? "Replace PDF" : "Choose PDF"}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return notifyError("Only PDF files are allowed."); setMonthlyFile(file); }} /></label>{monthlyFile && <span className="text-sm text-text-secondary">{monthlyFile.name}</span>}<Button color="primary" radius="lg" onPress={submitMonthlyReport}>Submit Monthly Report</Button></div>{monthlySubmission && <div className="mt-5 rounded-xl border border-border/60 bg-surface-muted p-4 text-sm"><p><span className="font-medium">File:</span> {monthlySubmission.fileName}</p><p><span className="font-medium">Submitted:</span> {formatDate(monthlySubmission.date)}</p><p><span className="font-medium">Status:</span> {monthlySubmission.status}</p>{monthlySubmission.marks != null && <p><span className="font-medium">Marks:</span> {monthlySubmission.marks}</p>}{monthlySubmission.feedback && <p><span className="font-medium">Feedback:</span> {monthlySubmission.feedback}</p>}</div>}</div>}
      {activeTab === "assessment" && <div className="space-y-4 rounded-card border border-border/60 bg-white p-5 shadow-card"><h2 className="text-lg font-semibold">Assessment &amp; Results</h2>{!evaluation ? <p className="text-sm text-text-secondary">Your final assessment has not been published yet.</p> : <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-2xl font-bold text-primary">Overall: {String(evaluation.overall_mark ?? "—")}</p><span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium">{String(evaluation.decision ?? "—")}</span></div><div className="space-y-2">{Array.isArray(evaluation.components) && (evaluation.components as Array<{ name?: string; mark?: number }>).map((component, index) => <div key={index} className="flex justify-between rounded-lg bg-surface-muted p-3 text-sm"><span>{component.name ?? `Component ${index + 1}`}</span><span className="font-semibold">{component.mark ?? "—"}</span></div>)}</div>{evaluation.notes && <p className="text-sm text-text-secondary">Notes: {String(evaluation.notes)}</p>}</>}</div>}
    </div>
  );
}

function ReportCard({
  report,
  onView,
  onDelete,
}: {
  report: LogbookReport;
  onView: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasReview = report.status === "accepted" || report.status === "rejected" || report.status === "reviewed";
  const canDelete = !hasReview;

  return (
    <article className="flex flex-col rounded-card border border-border/60 bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-text-primary">
          Report #{report.monthNumber}
        </h3>
        {report.isCurrent && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Current
          </span>
        )}
        <ReportStatusBadge status={report.status} />
      </div>
      <p className="text-sm font-medium text-text-secondary">{report.period}</p>
      <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{report.excerpt}</p>
      {report.pdfFileName && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
          <FileText size={14} />
          {report.pdfFileName}
        </p>
      )}
      {hasReview && report.marks != null && (
        <p className="mt-2 text-sm font-semibold text-text-primary">
          Marks: <span className="text-primary">{report.marks}</span>
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button color="primary" variant="flat" radius="lg" className="flex-1" onPress={onView}>
          View Details
        </Button>
        {canDelete && !confirmDelete && (
          <Button
            color="danger"
            variant="flat"
            radius="lg"
            isIconOnly
            onPress={() => setConfirmDelete(true)}
            aria-label="Delete report"
          >
            <Trash2 size={16} />
          </Button>
        )}
        {canDelete && confirmDelete && (
          <>
            <Button size="sm" color="danger" radius="lg" onPress={() => { onDelete(); setConfirmDelete(false); }}>
              Confirm
            </Button>
            <Button size="sm" variant="flat" radius="lg" onPress={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function ReportDetail({ report }: { report: LogbookReport }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-sm font-medium text-text-primary">
          {report.period}
        </span>
        <ReportStatusBadge status={report.status} />
        <span className="text-sm text-text-secondary">
          Submitted {formatDate(report.submittedAt)}
        </span>
      </div>

      <p className="text-base leading-relaxed text-text-primary">{report.excerpt}</p>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Submitted PDF</p>
        <PdfViewer url={report.pdfUrl} fileName={report.pdfFileName} />
      </div>

      {(report.status === "accepted" || report.status === "rejected" || report.status === "reviewed") && (
        <div className="grid gap-4 rounded-button border border-border/60 bg-surface-muted p-4 sm:grid-cols-2">
          {report.marks != null && (
            <div>
              <p className="text-xs font-semibold uppercase text-text-secondary">Marks</p>
              <p className="mt-1 text-2xl font-bold text-primary">{report.marks}</p>
            </div>
          )}
          {report.feedback && (
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">
                Supervisor Comments
              </p>
              <p className="mt-2 text-sm leading-relaxed text-text-primary">{report.feedback}</p>
            </div>
          )}
          {report.reviewedAt && (
            <p className="text-xs text-text-secondary sm:col-span-2">
              Reviewed on {formatDate(report.reviewedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
