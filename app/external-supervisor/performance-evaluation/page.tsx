"use client";

import { Button, Chip, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { useAppStore } from "@/lib/store/app-store";
import { filterTrainees, TraineeFilters } from "@/components/external-supervisor/trainee-filters";
import { ApprovalAccessBanner } from "@/components/external-supervisor/approval-access-banner";
import { apiCreateTrainingRecord, apiListTrainingRecords, apiUpdateTrainingRecord } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useEffect, useMemo, useState } from "react";

export default function PerformanceEvaluationPage() {
  const { students, currentUser } = useAppStore();
  const approvalAccess = currentUser?.approvalAccess !== false;
  const [student, setStudent] = useState("");
  const [score, setScore] = useState("");
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("pending_review");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [traineeSearch, setTraineeSearch] = useState("");
  const [traineeDepartment, setTraineeDepartment] = useState("all");
  const [traineeBatch, setTraineeBatch] = useState("all");

  const load = () => apiListTrainingRecords("completion_certifications")
    .then((result) => setItems(result.data))
    .catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load evaluations."));

  useEffect(() => { void load(); }, []);

  const selected = items.find((item) => String(item.student_id) === student);
  const filteredStudents = useMemo(
    () => filterTrainees(students, traineeSearch, traineeDepartment, traineeBatch),
    [students, traineeSearch, traineeDepartment, traineeBatch]
  );

  useEffect(() => {
    if (!selected) return;
    setScore(String(selected.performance_score ?? ""));
    setComments(String(selected.performance_comments ?? selected.work_comments ?? ""));
    setStatus(String(selected.performance_status ?? "pending_review"));
  }, [student, selected]);

  const submit = async () => {
    if (!student || score === "") return notifyError("Choose a trainee and enter a score.");
    const numeric = Number(score);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) return notifyError("Score must be between 0 and 100.");
    const payload = {
      student_id: student,
      external_supervisor_id: currentUser?.id,
      performance_score: numeric,
      performance_comments: comments.trim(),
      performance_status: status,
      work_comments: comments.trim(),
      certified_at: new Date().toISOString(),
    };
    try {
      if (selected?.id) await apiUpdateTrainingRecord("completion_certifications", String(selected.id), payload);
      else await apiCreateTrainingRecord("completion_certifications", payload);
      await load();
      notifySuccess("Performance evaluation saved.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save evaluation.");
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="ds-page-title">Performance Evaluation</h1>
      <p className="ds-page-description">Submit the final performance assessment for a trainee.</p>
      <ApprovalAccessBanner />
      <div className="space-y-4 rounded-card border border-border bg-white p-5">
        <TraineeFilters students={students} search={traineeSearch} department={traineeDepartment} batch={traineeBatch} onSearchChange={setTraineeSearch} onDepartmentChange={setTraineeDepartment} onBatchChange={setTraineeBatch} />
        <Select isDisabled={!approvalAccess} label="Trainee" placeholder="Select trainee" selectedKeys={student ? [student] : []} onSelectionChange={(keys) => setStudent(String(Array.from(keys)[0] ?? ""))} renderValue={() => students.find((item) => item.id === student)?.name ?? "Select trainee"}>
          {filteredStudents.map((item) => <SelectItem key={item.id} textValue={`${item.name} (${item.studentId})`}>{item.name} ({item.studentId})</SelectItem>)}
        </Select>
        <Input isDisabled={!approvalAccess} label="Final score (0-100)" type="number" min="0" max="100" value={score} onValueChange={setScore} />
        <Select isDisabled={!approvalAccess} label="Evaluation status" selectedKeys={[status]} onSelectionChange={(keys) => setStatus(String(Array.from(keys)[0] ?? "pending_review"))}>
          <SelectItem key="pending_review">Pending review</SelectItem>
          <SelectItem key="rejected">Rejected</SelectItem>
          <SelectItem key="accepted">Accepted</SelectItem>
        </Select>
        <Textarea isDisabled={!approvalAccess} label="Final comments" value={comments} onValueChange={setComments} minRows={5} />
        <Button isDisabled={!approvalAccess} color="primary" onPress={() => void submit()}>{selected ? "Update evaluation" : "Submit evaluation"}</Button>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Evaluation history</h2>
        {items.map((item) => <div key={String(item.id)} className="flex items-center justify-between rounded-card border border-border bg-white p-4"><div><p className="font-medium">{students.find((entry) => entry.id === String(item.student_id))?.name ?? "Trainee"}</p><p className="text-sm text-text-secondary">Score: {String(item.performance_score ?? "—")}</p></div><Chip variant="flat">{String(item.performance_status ?? "pending_review")}</Chip></div>)}
      </div>
    </div>
  );
}
