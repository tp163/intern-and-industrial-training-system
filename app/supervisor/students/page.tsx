"use client";

import { AppModal } from "@/components/ui/app-modal";
import { PdfViewer } from "@/components/reports/pdf-viewer";
import { TableScroll } from "@/components/ui/table-scroll";
import { ReportStatusBadge } from "@/components/reports/report-status-badge";
import { InternshipStatusPill } from "@/components/supervisor/internship-status-pill";
import { useAppStore } from "@/lib/store/app-store";
import { apiCreateTrainingRecord, apiListConductRecords, apiListTrainingRecords } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getInitials } from "@/lib/utils";
import type { Student } from "@/types";
import {
  Avatar,
  Button,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
} from "@heroui/react";
import { Download, Eye, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function SupervisorStudentsPage() {
  const { students, supervisors, getReportsForStudent, currentUser, loadRealData } = useAppStore();
  const supervisorRecord = useMemo(
    () =>
      supervisors.find((supervisor) => supervisor.id === currentUser?.id) ??
      supervisors.find((supervisor) => supervisor.email === currentUser?.email),
    [currentUser?.email, currentUser?.id, supervisors]
  );
  const supervisorId = supervisorRecord?.id ?? currentUser?.id ?? "";
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | undefined>();
  const [visit, setVisit] = useState({ proposedDate: "", actualDate: "", mode: "On site", observations: "", actions: "", providerFeedback: "" });
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [meetings, setMeetings] = useState<Record<string, unknown>[]>([]);
  const [placementConfirmations, setPlacementConfirmations] = useState<Record<string, unknown>[]>([]);
  const [commencementConfirmations, setCommencementConfirmations] = useState<Record<string, unknown>[]>([]);
  const [weeklyCertifications, setWeeklyCertifications] = useState<Record<string, unknown>[]>([]);
  const [conductRecords, setConductRecords] = useState<Array<Record<string, unknown> & { kind: string }>>([]);
  const [meeting, setMeeting] = useState({ date: "", type: "Monthly progress", attended: true, notes: "" });

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  const assignedStudents = useMemo(
    () => students.filter((s) => s.supervisorId === supervisorId),
    [students, supervisorId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    if (!q) return assignedStudents;
    return assignedStudents.filter(
      (s) =>
        [s.name, s.studentId, s.email]
          .some((value) => String(value ?? "").toLocaleLowerCase().includes(q))
    );
  }, [assignedStudents, search]);

  useEffect(() => {
    if (!selectedStudent) {
      setCvPreviewUrl(undefined);
      return;
    }
    if (selectedStudent.cvUrl) {
      setCvPreviewUrl(selectedStudent.cvUrl);
    } else {
      setCvPreviewUrl(undefined);
    }
  }, [selectedStudent]);

  const openProfile = (student: Student) => setSelectedStudent(student);
  const closeModal = () => setSelectedStudent(null);
  useEffect(() => {
    if (!selectedStudent) {
      setVisits([]);
      setMeetings([]);
      setPlacementConfirmations([]);
      setCommencementConfirmations([]);
      setWeeklyCertifications([]);
      setConductRecords([]);
      return;
    }
    Promise.all([
      apiListTrainingRecords("site_visits"),
      apiListTrainingRecords("meeting_attendance"),
      apiListTrainingRecords("placement_confirmations"),
      apiListTrainingRecords("commencement_confirmations"),
      apiListTrainingRecords("weekly_certifications"),
      apiListConductRecords("leave_requests"),
      apiListConductRecords("absence_reports"),
      apiListConductRecords("placement_change_requests"),
      apiListConductRecords("student_issues"),
    ])
      .then(([visitResult, meetingResult, placementResult, commencementResult, weeklyResult, leaveResult, absenceResult, changeResult, issueResult]) => {
        setVisits(visitResult.data.filter((item) => String(item.student_id) === selectedStudent.id));
        setMeetings(meetingResult.data.filter((item) => String(item.student_id) === selectedStudent.id));
        setPlacementConfirmations(placementResult.data.filter((item) => String(item.student_id) === selectedStudent.id));
        setCommencementConfirmations(commencementResult.data.filter((item) => String(item.student_id) === selectedStudent.id));
        setWeeklyCertifications(weeklyResult.data.filter((item) => String(item.student_id) === selectedStudent.id));
        const submittedConduct = [
          ...leaveResult.data.map((item) => ({ ...item, kind: "Leave request" })),
          ...absenceResult.data.map((item) => ({ ...item, kind: "Absence report" })),
          ...changeResult.data.map((item) => ({ ...item, kind: "Placement change" })),
          ...issueResult.data.map((item) => ({ ...item, kind: "Reported issue" })),
        ] as Array<Record<string, unknown> & { kind: string }>;
        setConductRecords(submittedConduct.filter((item) => String(item.student_id) === selectedStudent.id));
      })
      .catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load student training records."));
  }, [selectedStudent]);

  const saveVisit = async () => {
    if (!selectedStudent || !visit.proposedDate) return notifyError("Please enter a proposed visit date.");
    try {
      await apiCreateTrainingRecord("site_visits", {
        student_id: selectedStudent.id,
        supervisor_id: supervisorId,
        proposed_date: visit.proposedDate,
        actual_date: visit.actualDate || null,
        mode: visit.mode,
        observations: visit.observations,
        actions_recommended: visit.actions,
        provider_feedback: visit.providerFeedback,
        status: visit.actualDate ? "completed" : "scheduled",
      });
      const refreshed = await apiListTrainingRecords("site_visits");
      setVisits(refreshed.data.filter((item) => String(item.student_id) === selectedStudent.id));
      setVisit({ proposedDate: "", actualDate: "", mode: "On site", observations: "", actions: "", providerFeedback: "" });
      notifySuccess("Site visit saved.");
    } catch (error) { notifyError(error instanceof Error ? error.message : "Failed to save site visit."); }
  };

  const saveMeeting = async () => {
    if (!selectedStudent || !meeting.date) return notifyError("Please enter the meeting date.");
    try {
      await apiCreateTrainingRecord("meeting_attendance", {
        student_id: selectedStudent.id,
        supervisor_id: supervisorId,
        meeting_date: meeting.date,
        meeting_type: meeting.type,
        attended: meeting.attended,
        notes: meeting.notes,
      });
      const refreshed = await apiListTrainingRecords("meeting_attendance");
      setMeetings(refreshed.data.filter((item) => String(item.student_id) === selectedStudent.id));
      setMeeting({ date: "", type: "Monthly progress", attended: true, notes: "" });
      notifySuccess("Meeting attendance saved.");
    } catch (error) { notifyError(error instanceof Error ? error.message : "Failed to save meeting attendance."); }
  };

  const studentReports = selectedStudent
    ? getReportsForStudent(selectedStudent.id)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-secondary">
          {currentUser?.department ?? "Faculty Supervisor"}{" "}
          <span className="mx-1 text-text-secondary/60">&gt;</span> Students
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="ds-page-title">Students</h1>
            <p className="ds-page-description">
              View complete profiles, CVs, and internship details for assigned students.
            </p>
          </div>
          <div className="rounded-card border border-border/60 bg-surface-muted px-4 py-2 text-sm font-semibold text-text-primary">
            {filtered.length} assigned
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border/60 bg-white p-4 shadow-card sm:p-6">
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            size={18}
          />
          <input
            type="search"
            placeholder="Search by Student ID or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-input border border-border bg-white py-2.5 pl-10 pr-4 text-base text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border/60 bg-white shadow-card">
        <TableScroll>
          <Table aria-label="Assigned students" removeWrapper>
            <TableHeader>
              <TableColumn>STUDENT</TableColumn>
              <TableColumn className="hidden sm:table-cell">STUDENT ID</TableColumn>
              <TableColumn>DEPARTMENT</TableColumn>
              <TableColumn className="hidden md:table-cell">ACADEMIC YEAR</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No students assigned to you match this search.">
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={getInitials(student.name)}
                        size="sm"
                        getInitials={getInitials}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">{student.name}</p>
                        <p className="text-xs text-text-secondary sm:hidden">{student.studentId}</p>
                        <p className="text-xs text-text-secondary">{student.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-medium text-text-secondary">
                    {student.studentId}
                  </TableCell>
                  <TableCell>{student.departmentCode ?? student.program}</TableCell>
                  <TableCell className="hidden md:table-cell">{student.academicYear ?? student.batch ?? "—"}</TableCell>
                  <TableCell>
                    {student.internshipStatus ? (
                      <InternshipStatusPill status={student.internshipStatus} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      startContent={<Eye size={14} />}
                      onPress={() => openProfile(student)}
                    >
                      View Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      </div>

      <AppModal
        isOpen={!!selectedStudent}
        onClose={closeModal}
        title={selectedStudent ? `${selectedStudent.name} — Profile` : "Student Profile"}
        size="3xl"
        footer={
          <Button variant="light" onPress={closeModal}>Close</Button>
        }
      >
        {selectedStudent && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Personal &amp; Academic
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField label="Name" value={selectedStudent.name} />
                <ProfileField label="Student ID" value={selectedStudent.studentId} />
                <ProfileField label="Email" value={selectedStudent.email} />
                <ProfileField label="Phone" value={selectedStudent.phone ?? "—"} />
                <ProfileField label="Department" value={selectedStudent.departmentCode ?? "—"} />
                <ProfileField label="Program" value={selectedStudent.program} />
                <ProfileField label="Academic Year" value={selectedStudent.academicYear ?? selectedStudent.batch ?? "—"} />
              </div>
            </section>

            <section className="space-y-4">
              <div><h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Site Visits</h3><p className="mt-1 text-sm text-text-secondary">Schedule a visit or record the completed visit for this student.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><Input label="Proposed date" type="date" value={visit.proposedDate} onValueChange={(proposedDate) => setVisit({ ...visit, proposedDate })}/><Input label="Actual date" type="date" value={visit.actualDate} onValueChange={(actualDate) => setVisit({ ...visit, actualDate })}/><Select label="Mode" selectedKeys={[visit.mode]} onSelectionChange={(keys) => setVisit({ ...visit, mode: String(Array.from(keys)[0]) })}><SelectItem key="On site">On site</SelectItem><SelectItem key="Virtual">Virtual</SelectItem><SelectItem key="Hybrid">Hybrid</SelectItem></Select></div>
              <Textarea label="Observations" value={visit.observations} onValueChange={(observations) => setVisit({ ...visit, observations })}/><Textarea label="Actions recommended" value={visit.actions} onValueChange={(actions) => setVisit({ ...visit, actions })}/><Textarea label="Provider feedback (optional)" value={visit.providerFeedback} onValueChange={(providerFeedback) => setVisit({ ...visit, providerFeedback })}/><Button color="primary" onPress={saveVisit}>Schedule / save visit</Button>
              <div className="space-y-2"><h4 className="text-sm font-semibold">Visit history</h4>{visits.length === 0 ? <p className="text-sm text-text-secondary">No visits recorded yet.</p> : visits.map((item) => <div key={String(item.id)} className="rounded-button bg-surface-muted p-3 text-sm"><p className="font-medium">{String(item.status ?? "scheduled")} · {String(item.proposed_date ?? "No date")}</p><p className="text-text-secondary">{String(item.observations ?? "No observations")}</p></div>)}</div>
            </section>

            <section className="space-y-4">
              <div><h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Meetings</h3><p className="mt-1 text-sm text-text-secondary">Record monthly progress meeting attendance and notes.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><Input label="Meeting date" type="date" value={meeting.date} onValueChange={(date) => setMeeting({ ...meeting, date })}/><Select label="Meeting type" selectedKeys={[meeting.type]} onSelectionChange={(keys) => setMeeting({ ...meeting, type: String(Array.from(keys)[0]) })}><SelectItem key="Monthly progress">Monthly progress</SelectItem><SelectItem key="Review meeting">Review meeting</SelectItem></Select></div>
              <Textarea label="Notes" value={meeting.notes} onValueChange={(notes) => setMeeting({ ...meeting, notes })}/><Button color="primary" variant="flat" onPress={saveMeeting}>Save meeting attendance</Button>
              <div className="space-y-2"><h4 className="text-sm font-semibold">Meeting history</h4>{meetings.length === 0 ? <p className="text-sm text-text-secondary">No meetings recorded yet.</p> : meetings.map((item) => <div key={String(item.id)} className="rounded-button bg-surface-muted p-3 text-sm"><p className="font-medium">{String(item.meeting_type ?? "Meeting")} · {String(item.meeting_date)}</p><p className="text-text-secondary">{item.attended ? "Attended" : "Absent"}{item.notes ? ` · ${String(item.notes)}` : ""}</p></div>)}</div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Conduct & Support Submissions</h3>
              {conductRecords.length === 0 ? <p className="text-sm text-text-secondary">No leave, absence, placement-change, or issue submissions.</p> : <div className="space-y-2">{conductRecords.map((item) => <div key={`${item.kind}-${String(item.id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-border/60 bg-surface-muted p-3"><div><p className="text-sm font-medium text-text-primary">{item.kind}</p><p className="mt-1 text-xs text-text-secondary">{String(item.reason ?? item.description ?? item.absence_dates ?? "Submitted by student")}</p></div><span className="text-xs font-semibold capitalize text-text-secondary">{String(item.status ?? "pending").replaceAll("_", " ")}</span></div>)}</div>}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">Training Submissions</h3>
              <div className="space-y-3">
                <SubmissionRow label="Placement confirmation" item={placementConfirmations[0]} />
                <SubmissionRow label="Commencement confirmation" item={commencementConfirmations[0]} />
                <div className="rounded-button border border-border/60 bg-surface-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="text-sm font-medium text-text-primary">Weekly certification documents</p><p className="mt-1 text-xs text-text-secondary">{weeklyCertifications.length} submitted</p></div>
                    <span className="text-xs font-semibold text-text-secondary">{weeklyCertifications.filter((item) => item.status === "certified").length} certified</span>
                  </div>
                  {weeklyCertifications.length > 0 && <div className="mt-2 space-y-1">{weeklyCertifications.map((item) => <div key={String(item.id)} className="flex items-center justify-between gap-2 text-xs text-text-secondary"><span>{String(item.week_start_date)} to {String(item.week_end_date)} · {String(item.status ?? "submitted").replaceAll("_", " ")}</span>{Boolean(item.file_url) && <Button size="sm" variant="light" startContent={<FileText size={13} />} onPress={() => window.open(String(item.file_url), "_blank")}>View PDF</Button>}</div>)}</div>}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Internship Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileField
                  label="Company"
                  value={selectedStudent.internshipCompany ?? "—"}
                />
                <ProfileField label="Role" value={selectedStudent.internshipRole ?? "—"} />
                <ProfileField
                  label="Internship Duration"
                  value={
                    selectedStudent.internshipStartDate || selectedStudent.internshipEndDate
                      ? `${selectedStudent.internshipStartDate ?? "—"} to ${selectedStudent.internshipEndDate ?? "—"}`
                      : "—"
                  }
                />
                <div>
                  <p className="text-xs font-semibold uppercase text-text-secondary">Placement Status</p>
                  <div className="mt-2">
                    {selectedStudent.internshipStatus ? (
                      <InternshipStatusPill status={selectedStudent.internshipStatus} />
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <ProfileField
                  label="Logbook Submissions"
                  value={`${studentReports.length} report(s)`}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Logbook Reports
              </h3>
              {studentReports.length === 0 ? (
                <p className="text-sm text-text-secondary">No reports submitted yet.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {studentReports.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-button border border-border/60 bg-surface-muted p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {r.period} · #{r.monthNumber}
                        </p>
                        {r.marks != null && (
                          <p className="text-xs text-text-secondary">Marks: {r.marks}</p>
                        )}
                        {r.feedback && (
                          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                            {r.feedback}
                          </p>
                        )}
                      </div>
                      <ReportStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  Latest CV
                </h3>
                {selectedStudent.cvFileName && (
                  <Button
                    size="sm"
                    variant="bordered"
                    startContent={<Download size={14} />}
                    onPress={() => window.open(cvPreviewUrl, "_blank")}
                  >
                    Download CV
                  </Button>
                )}
              </div>
              {selectedStudent.cvFileName ? (
                <>
                  <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                    <FileText size={16} />
                    {selectedStudent.cvFileName}
                  </p>
                  <PdfViewer url={cvPreviewUrl} fileName={selectedStudent.cvFileName} />
                </>
              ) : (
                <p className="rounded-button border border-dashed border-border p-6 text-center text-sm text-text-secondary">
                  No CV uploaded yet.
                </p>
              )}
            </section>
          </div>
        )}
      </AppModal>
    </div>
  );
}

function SubmissionRow({ label, item }: { label: string; item?: Record<string, unknown> }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-border/60 bg-surface-muted p-3"><div><p className="text-sm font-medium text-text-primary">{label}</p><p className="mt-1 text-xs text-text-secondary">{item ? `Status: ${String(item.status ?? "submitted").replaceAll("_", " ")}` : "Not submitted"}</p></div>{Boolean(item?.file_url) && <Button size="sm" variant="bordered" startContent={<FileText size={14} />} onPress={() => window.open(String(item?.file_url), "_blank")}>View PDF</Button>}</div>;
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-base font-medium text-text-primary">{value}</p>
    </div>
  );
}
