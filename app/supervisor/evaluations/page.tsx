"use client";

import { Button, Chip, Input, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Textarea } from "@heroui/react";
import { useAppStore } from "@/lib/store/app-store";
import { apiCreateTrainingRecord, apiListTrainingRecords } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useEffect, useMemo, useState } from "react";

type MarkingComponent = { name: string; maxMark: number; mark: string; remarks: string };
type Evaluation = Record<string, unknown> & { id: string };

/**
 * Final assessment marking sheet — the weighted components of the industrial
 * training programme add up to a total of 100 marks.
 */
const defaultComponents: MarkingComponent[] = [
  { name: "Daily Logbook & Weekly Certifications", maxMark: 15, mark: "", remarks: "" },
  { name: "Fortnightly Interim Reports (Form A)", maxMark: 10, mark: "", remarks: "" },
  { name: "Monthly Progress Reports (Form B)", maxMark: 10, mark: "", remarks: "" },
  { name: "Final Report & Presentation", maxMark: 15, mark: "", remarks: "" },
  { name: "Internal Supervisor Assessment", maxMark: 25, mark: "", remarks: "" },
  { name: "External Supervisor Assessment", maxMark: 25, mark: "", remarks: "" },
];

const decisionOptions = [
  { key: "pass", label: "Pass" },
  { key: "resubmit", label: "Resubmit" },
  { key: "extend", label: "Extend" },
  { key: "repeat", label: "Repeat" },
];

const decisionColors: Record<string, "success" | "warning" | "primary" | "danger"> = {
  pass: "success",
  resubmit: "warning",
  extend: "primary",
  repeat: "danger",
};

export default function SupervisorEvaluationsPage() {
  const { students, supervisors, currentUser } = useAppStore();
  const supervisorId = useMemo(
    () => supervisors.find((supervisor) => supervisor.id === currentUser?.id)?.id ?? currentUser?.id ?? "",
    [currentUser?.id, supervisors]
  );
  const assignedStudents = students.filter((student) => student.supervisorId === supervisorId);
  const [items, setItems] = useState<Evaluation[]>([]);
  const [studentId, setStudentId] = useState("");
  const [components, setComponents] = useState<MarkingComponent[]>(defaultComponents);
  const [decision, setDecision] = useState("resubmit");
  const [notes, setNotes] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => apiListTrainingRecords("evaluation_records")
    .then((result) => setItems(result.data as Evaluation[]))
    .catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load evaluations."));

  useEffect(() => { void load(); }, []);

  const selected = items.find((item) => String(item.student_id) === studentId);

  useEffect(() => {
    if (!selected) {
      setComponents(defaultComponents);
      setDecision("resubmit");
      setNotes("");
      setPublished(false);
      return;
    }
    const saved = Array.isArray(selected.components) ? selected.components as Array<Record<string, unknown>> : [];
    setComponents(
      saved.length
        ? saved.map((component) => ({
            name: String(component.name ?? ""),
            maxMark: Number(component.maxMark ?? component.max_mark ?? 100) || 100,
            mark: component.mark == null || component.mark === "" ? "" : String(component.mark),
            remarks: String(component.remarks ?? ""),
          }))
        : defaultComponents
    );
    setDecision(String(selected.decision ?? "resubmit"));
    setNotes(String(selected.notes ?? ""));
    setPublished(Boolean(selected.published));
  }, [selected, studentId]);

  const totalMax = components.reduce((sum, component) => sum + (Number(component.maxMark) || 0), 0);
  const overall = components.reduce((sum, component) => sum + (Number(component.mark) || 0), 0);

  const save = async () => {
    if (!studentId) return notifyError("Choose an assigned student.");
    if (components.some((component) => !component.name.trim())) {
      return notifyError("Every component needs a name.");
    }
    if (components.some((component) => component.mark.trim() === "" || Number(component.mark) < 0 || Number(component.mark) > Number(component.maxMark))) {
      return notifyError("Enter a mark between 0 and the component's maximum for every component.");
    }
    setSaving(true);
    try {
      await apiCreateTrainingRecord("evaluation_records", {
        student_id: studentId,
        evaluator_id: supervisorId,
        components: components.map((component) => ({
          name: component.name,
          maxMark: Number(component.maxMark),
          mark: Number(component.mark),
          remarks: component.remarks,
        })),
        overall_mark: overall,
        decision,
        notes: notes.trim(),
        published,
      });
      await load();
      notifySuccess(published ? "Marking sheet saved and published." : "Marking sheet saved.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save the evaluation.");
    } finally {
      setSaving(false);
    }
  };

  const selectedStudent = assignedStudents.find((student) => student.id === studentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title">Evaluations</h1>
        <p className="ds-page-description">
          Complete the final assessment marking sheet, record component marks, and publish results for assigned trainees.
        </p>
      </div>

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-text-primary">Assigned student
            <select className="mt-2 w-full rounded-input border border-border bg-white px-3 py-2.5" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">Select student</option>
              {assignedStudents.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.studentId})</option>)}
            </select>
          </label>
          {selectedStudent ? (
            <div className="rounded-input border border-border/60 bg-surface-muted px-4 py-3 text-sm">
              <p><span className="font-medium">Academic Year:</span> {selectedStudent.academicYear ?? selectedStudent.batch ?? "—"}</p>
              <p className="mt-1"><span className="font-medium">Program:</span> {selectedStudent.program || "—"}</p>
              <p className="mt-1">
                <span className="font-medium">Internship:</span>{" "}
                {selectedStudent.internshipCompany || "—"}
                {selectedStudent.internshipStartDate || selectedStudent.internshipEndDate
                  ? ` (${selectedStudent.internshipStartDate ?? "?"} to ${selectedStudent.internshipEndDate ?? "?"})`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>

        {/* Marking sheet */}
        <div className="overflow-x-auto rounded-input border border-border/60">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3">Component</th>
                <th className="w-28 px-4 py-3">Max Marks</th>
                <th className="w-32 px-4 py-3">Marks Awarded</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="w-24 px-4 py-3">Weight</th>
              </tr>
            </thead>
            <tbody>
              {components.map((component, index) => (
                <tr key={index} className="border-t border-border/50 align-top">
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Component ${index + 1} name`}
                      value={component.name}
                      onValueChange={(value) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item))}
                      variant="bordered"
                      radius="lg"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Component ${index + 1} maximum marks`}
                      type="number"
                      min={1}
                      value={String(component.maxMark)}
                      onValueChange={(value) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, maxMark: Number(value) || 0 } : item))}
                      variant="bordered"
                      radius="lg"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Component ${index + 1} marks`}
                      type="number"
                      min={0}
                      max={component.maxMark}
                      value={component.mark}
                      onValueChange={(value) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, mark: value } : item))}
                      variant="bordered"
                      radius="lg"
                      isInvalid={component.mark.trim() !== "" && (Number(component.mark) < 0 || Number(component.mark) > component.maxMark)}
                      errorMessage={`0 – ${component.maxMark}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Component ${index + 1} remarks`}
                      value={component.remarks}
                      onValueChange={(value) => setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, remarks: value } : item))}
                      variant="bordered"
                      radius="lg"
                      placeholder="Optional remarks"
                    />
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {totalMax > 0 ? `${Math.round((Number(component.maxMark) / totalMax) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-muted font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{totalMax}</td>
                <td className="px-4 py-3 text-primary">{overall}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {totalMax > 0 ? `${Math.round((overall / totalMax) * 100)}% overall` : "—"}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm font-medium text-text-primary">Overall decision
            <select className="mt-2 w-64 rounded-input border border-border bg-white px-3 py-2.5" value={decision} onChange={(event) => setDecision(event.target.value)}>
              {decisionOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Publish results to student</label>
        </div>

        <Textarea label="Notes or conditions" value={notes} onValueChange={setNotes} minRows={3} />

        <Button color="primary" isLoading={saving} onPress={() => void save()}>Save marking sheet</Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Evaluation records</h2>
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary">No evaluations yet.</p>
        ) : (
          <Table aria-label="Evaluation records" removeWrapper>
            <TableHeader>
              <TableColumn>STUDENT</TableColumn>
              <TableColumn>OVERALL</TableColumn>
              <TableColumn>DECISION</TableColumn>
              <TableColumn>STATUS</TableColumn>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{assignedStudents.find((student) => student.id === String(item.student_id))?.name ?? "Assigned student"}</p>
                      <p className="text-xs text-text-secondary">
                        {(Array.isArray(item.components) ? item.components as Array<{ name?: string; mark?: number; maxMark?: number }> : [])
                          .map((component) => `${component.name}: ${component.mark ?? "—"}/${component.maxMark ?? 100}`)
                          .join(" · ") || "No components recorded"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">{String(item.overall_mark ?? "—")}</span>
                  </TableCell>
                  <TableCell>
                    <Chip variant="flat" color={decisionColors[String(item.decision)] ?? "default"}>
                      {String(item.decision).charAt(0).toUpperCase() + String(item.decision).slice(1)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip variant="flat" color={item.published ? "success" : "warning"}>
                      {item.published ? "Published" : "Draft"}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
