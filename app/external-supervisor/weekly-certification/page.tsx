"use client";

import { Button, Select, SelectItem, Textarea } from "@heroui/react";
import { useAppStore } from "@/lib/store/app-store";
import { filterTrainees, TraineeFilters } from "@/components/external-supervisor/trainee-filters";
import { ApprovalAccessBanner } from "@/components/external-supervisor/approval-access-banner";
import { apiListTrainingRecords, apiUpdateTrainingRecord } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useEffect, useMemo, useState } from "react";

export default function WeeklyCertificationPage() {
  const { students, currentUser } = useAppStore();
  const approvalAccess = currentUser?.approvalAccess !== false;
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [studentFilter, setStudentFilter] = useState("all");
  const [traineeSearch, setTraineeSearch] = useState("");
  const [traineeDepartment, setTraineeDepartment] = useState("all");
  const [traineeBatch, setTraineeBatch] = useState("all");

  const load = () => apiListTrainingRecords("weekly_certifications").then((result) => setItems(result.data)).catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load weekly certifications."));
  useEffect(() => { void load(); }, []);

  const filtered = items.filter((item) => studentFilter === "all" || String(item.student_id) === studentFilter);
  const filteredStudents = useMemo(
    () => filterTrainees(students, traineeSearch, traineeDepartment, traineeBatch),
    [students, traineeSearch, traineeDepartment, traineeBatch]
  );
  const studentOptions = [{ id: "all", name: "All trainees", studentId: "" }, ...filteredStudents];
  const update = async (item: Record<string, unknown>, status: string) => {
    try {
      await apiUpdateTrainingRecord("weekly_certifications", String(item.id), {
        status,
        external_supervisor_feedback: remarks[String(item.id)] ?? String(item.external_supervisor_feedback ?? ""),
        reviewed_at: new Date().toISOString(),
      });
      await load();
      notifySuccess(status === "certified" ? "Week certified." : "Revision requested.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to update certification.");
    }
  };

  return <div className="space-y-5">
    <h1 className="ds-page-title">Weekly Certification</h1>
    <ApprovalAccessBanner />
    <TraineeFilters students={students} search={traineeSearch} department={traineeDepartment} batch={traineeBatch} onSearchChange={setTraineeSearch} onDepartmentChange={setTraineeDepartment} onBatchChange={setTraineeBatch} />
    <Select label="Trainee" items={studentOptions} selectedKeys={[studentFilter]} onSelectionChange={(keys) => setStudentFilter(String(Array.from(keys)[0] ?? "all"))} renderValue={() => studentFilter === "all" ? "All trainees" : students.find((student) => student.id === studentFilter)?.name ?? "Select trainee"}>
      {(student) => <SelectItem key={student.id} textValue={`${student.name} ${student.studentId}`}>{student.name}{student.studentId ? ` (${student.studentId})` : ""}</SelectItem>}
    </Select>
    {filtered.length === 0 ? <p className="text-text-secondary">No weekly certifications submitted yet.</p> : filtered.map((item) => <div key={String(item.id)} className="space-y-3 rounded-card border border-border bg-white p-5"><p className="font-semibold">{students.find((student) => student.id === String(item.student_id))?.name ?? "Trainee"} · Week: {String(item.week_start_date)} – {String(item.week_end_date)}</p><p className="text-sm">Status: {String(item.status)}</p>{Boolean(item.file_url) && <a className="text-sm text-primary underline" href={String(item.file_url)} target="_blank" rel="noreferrer">View weekly certification PDF</a>}<Textarea isDisabled={!approvalAccess} label="External supervisor remarks" value={remarks[String(item.id)] ?? String(item.external_supervisor_feedback ?? "")} onValueChange={(value) => setRemarks({ ...remarks, [String(item.id)]: value })}/><div className="flex gap-2"><Button isDisabled={!approvalAccess} color="success" onPress={() => void update(item, "certified")}>Approve</Button><Button isDisabled={!approvalAccess} color="danger" variant="flat" onPress={() => void update(item, "revision_required")}>Request revision</Button></div></div>)}
  </div>;
}
