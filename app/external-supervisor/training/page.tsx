"use client";

import { Button, Checkbox, Input, Select, SelectItem, Textarea, Chip } from "@heroui/react";
import { useAppStore } from "@/lib/store/app-store";
import { filterTrainees, TraineeFilters } from "@/components/external-supervisor/trainee-filters";
import { ApprovalAccessBanner } from "@/components/external-supervisor/approval-access-banner";
import { apiCreateTrainingRecord, apiListTrainingRecords, apiUploadFile } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { FileText, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const attendanceStatuses = ["Present", "Late", "Absent"];

type TrainingRecord = Record<string, unknown>;

export default function TrainingPage() {
  const { students, currentUser } = useAppStore();
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [completionStudentId, setCompletionStudentId] = useState("");
  const [date, setDate] = useState("");
  const [attendance, setAttendance] = useState("Present");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [remarks, setRemarks] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [departments, setDepartments] = useState("");
  const [traineeSearch, setTraineeSearch] = useState("");
  const [traineeDepartment, setTraineeDepartment] = useState("all");
  const [traineeBatch, setTraineeBatch] = useState("all");
  const [signed, setSigned] = useState(false);
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const completionFileRef = useRef<HTMLInputElement>(null);
  const [attendanceRows, setAttendanceRows] = useState<TrainingRecord[]>([]);
  const [certifications, setCertifications] = useState<TrainingRecord[]>([]);

  const load = async () => {
    const [attendanceResult, certificationResult] = await Promise.all([
      apiListTrainingRecords("attendance_records"),
      apiListTrainingRecords("completion_certifications"),
    ]);
    setAttendanceRows(attendanceResult.data);
    setCertifications(certificationResult.data);
  };

  useEffect(() => {
    void load().catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load training records."));
  }, []);

  const selectedCertification = certifications.find((item) => String(item.student_id) === completionStudentId);
  const filteredAttendance = useMemo(
    () => attendanceRows.filter((item) => attendanceFilter === "all" || String(item.status) === attendanceFilter),
    [attendanceRows, attendanceFilter]
  );
  const filteredStudents = useMemo(
    () => filterTrainees(students, traineeSearch, traineeDepartment, traineeBatch),
    [students, traineeSearch, traineeDepartment, traineeBatch]
  );

  const selectedStudentNames = students
    .filter((student) => selectedStudentIds.includes(student.id))
    .map((student) => student.name)
    .join(", ");

  const saveAttendance = async () => {
    if (selectedStudentIds.length === 0 || !date) return notifyError("Select one or more trainees and a date.");
    try {
      await Promise.all(selectedStudentIds.map((studentId) => apiCreateTrainingRecord("attendance_records", {
        student_id: studentId,
        external_supervisor_id: currentUser?.id,
        attendance_date: date,
        status: attendance,
        remarks: remarks.trim() || null,
      })));
      await load();
      setDate("");
      setRemarks("");
      notifySuccess(`Attendance saved for ${selectedStudentIds.length} trainee(s).`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save attendance.");
    }
  };

  const handleCompletionFile = (file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notifyError("Completion certification must be a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notifyError("Completion certification PDF must be 10MB or smaller.");
      return;
    }
    setCompletionFile(file);
  };

  const certify = async () => {
    if (!completionStudentId || !periodFrom || !periodTo || !completionFile || !signed) {
      return notifyError("Choose a trainee, complete the period, attach the PDF, and confirm the sign-off.");
    }
    try {
      const uploaded = await apiUploadFile(completionFile);
      await apiCreateTrainingRecord("completion_certifications", {
        student_id: completionStudentId,
        external_supervisor_id: currentUser?.id,
        period_from: periodFrom,
        period_to: periodTo,
        departments: departments.trim() || null,
        completion_file_url: uploaded.url,
        completion_file_name: completionFile.name,
        certified_at: new Date().toISOString(),
      });
      await load();
      setCompletionFile(null);
      if (completionFileRef.current) completionFileRef.current.value = "";
      notifySuccess("Completion certification PDF submitted.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to submit completion certification.");
    }
  };

  return <div className="space-y-6">
    <div><h1 className="ds-page-title">Training Overview</h1><p className="ds-page-description">Monitor attendance and certify completed training for assigned trainees.</p></div>
    <ApprovalAccessBanner />

    <section className="space-y-4 rounded-card border border-border bg-white p-5">
      <h2 className="text-lg font-semibold">Attendance</h2>
      <TraineeFilters students={students} search={traineeSearch} department={traineeDepartment} batch={traineeBatch} onSearchChange={setTraineeSearch} onDepartmentChange={setTraineeDepartment} onBatchChange={setTraineeBatch} />
      <Select
        label="Trainees"
        placeholder="Select trainees"
        selectionMode="multiple"
        selectedKeys={new Set(selectedStudentIds)}
        onSelectionChange={(keys) => setSelectedStudentIds(keys === "all" ? filteredStudents.map((student) => student.id) : Array.from(keys).map(String))}
        renderValue={() => selectedStudentNames || "Select trainees"}
      >
        {filteredStudents.map((student) => <SelectItem key={student.id} textValue={`${student.name} (${student.studentId})`}>{student.name} ({student.studentId})</SelectItem>)}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Date" type="date" value={date} onValueChange={setDate}/><label className="block text-sm font-medium text-text-primary">Attendance status<select className="mt-2 w-full rounded-input border border-border bg-white px-3 py-2.5" value={attendance} onChange={(event) => setAttendance(event.target.value)}>{attendanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div>
      <Textarea label="Remarks" value={remarks} onValueChange={setRemarks}/>
      <Button color="primary" onPress={() => void saveAttendance()}>Mark attendance for selected trainees</Button>
      <div className="space-y-2"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Attendance history</h3><select aria-label="Filter attendance status" className="rounded-input border border-border bg-white px-3 py-2 text-sm" value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)}><option value="all">All statuses</option>{attendanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>{filteredAttendance.length === 0 ? <p className="text-sm text-text-secondary">No attendance records match this filter.</p> : filteredAttendance.map((item) => <div key={String(item.id)} className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted p-3 text-sm"><span>{students.find((student) => student.id === String(item.student_id))?.name ?? "Trainee"} · {String(item.attendance_date)}{item.remarks ? ` · ${String(item.remarks)}` : ""}</span><Chip size="sm" variant="flat" color={item.status === "Absent" ? "danger" : item.status === "Late" ? "warning" : "success"}>{String(item.status)}</Chip></div>)}</div>
    </section>

    <section className="space-y-4 rounded-card border border-border bg-white p-5">
      <h2 className="text-lg font-semibold">Completion Certification</h2>
      <Select label="Trainee" placeholder="Select trainee" selectedKeys={completionStudentId ? [completionStudentId] : []} onSelectionChange={(keys) => setCompletionStudentId(String(Array.from(keys)[0] ?? ""))} renderValue={() => students.find((student) => student.id === completionStudentId)?.name ?? "Select trainee"}>
        {filteredStudents.map((student) => <SelectItem key={student.id} textValue={`${student.name} (${student.studentId})`}>{student.name} ({student.studentId})</SelectItem>)}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="Period from" type="date" value={periodFrom} onValueChange={setPeriodFrom}/><Input label="Period to" type="date" value={periodTo} onValueChange={setPeriodTo}/></div>
      <Input label="Departments" placeholder="Departments completed" value={departments} onValueChange={setDepartments}/>
      <div className="rounded-lg border border-dashed border-border p-4"><input ref={completionFileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => { handleCompletionFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}/><Button variant="bordered" startContent={<Upload size={16}/>} onPress={() => completionFileRef.current?.click()}>{completionFile ? "Replace certification PDF" : "Upload completion certification PDF"}</Button>{completionFile && <p className="mt-2 inline-flex items-center gap-2 text-sm text-text-secondary"><FileText size={15}/>{completionFile.name}</p>}</div>
      <Checkbox isDisabled={currentUser?.approvalAccess === false} isSelected={signed} onValueChange={setSigned}>I confirm that this completion certification is accurate.</Checkbox>
      {selectedCertification && <p className="text-sm text-text-secondary">Existing certification: {String(selectedCertification.completion_file_name ?? "PDF submitted")}.</p>}
      <Button isDisabled={currentUser?.approvalAccess === false} color="primary" onPress={() => void certify()}>Submit completion certification</Button>
    </section>
  </div>;
}
