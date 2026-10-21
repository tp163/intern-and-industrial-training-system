"use client";

import { ContentCard } from "@/components/ui/page-header";
import { notifyError, notifySuccess } from "@/lib/notify";
import { authFetch } from "@/lib/auth-fetch";
import { formatDate, isFutureDate, isPositiveInteger } from "@/lib/utils";
import type { Student } from "@/types";
import {
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getPeriodFromDate(dateValue: string): string {
  if (!dateValue) return "";
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

type ReportDeadline = {
  id: string;
  student_id: string;
  student_name?: string;
  month_number: number;
  period: string;
  due_date: string;
  report_type?: string;
  status: string;
};

export function ReportDeadlineManager({ students }: { students: Student[] }) {
  const [deadlines, setDeadlines] = useState<ReportDeadline[]>([]);
  const [academicYearFilter, setAcademicYearFilter] = useState("all");
  const [deadlineForm, setDeadlineForm] = useState({
    studentIds: [] as string[],
    monthNumber: "1",
    dueDate: "",
    reportType: "Monthly Logbook",
  });
  const [savingDeadline, setSavingDeadline] = useState(false);

  const studentIds = new Set(students.map((student) => student.id));
  const selectedStudents = students.filter((student) => deadlineForm.studentIds.includes(student.id));
  const studentById = new Map(students.map((student) => [student.id, student]));

  // Academic year filtering (e.g. 2020/2021). Students without an academic
  // year are grouped under "Not set".
  const academicYearOptions = useMemo(() => {
    const years = Array.from(
      new Set(students.map((student) => student.academicYear?.trim() || "Not set"))
    ).sort((a, b) => b.localeCompare(a));
    return ["all", ...years];
  }, [students]);

  const academicYearMatches = (studentId: string) => {
    if (academicYearFilter === "all") return true;
    const student = studentById.get(studentId);
    return (student?.academicYear?.trim() || "Not set") === academicYearFilter;
  };

  const visibleDeadlines = deadlines.filter(
    (deadline) => studentIds.has(deadline.student_id) && academicYearMatches(deadline.student_id)
  );

  const loadDeadlines = async () => {
    try {
      const response = await authFetch(`${API_BASE}/report_deadlines`);
      const result = await response.json();
      if (response.ok && result.success) setDeadlines(result.data ?? []);
    } catch {
      setDeadlines([]);
    }
  };

  useEffect(() => {
    loadDeadlines();
    const refreshOnFocus = () => loadDeadlines();
    const refreshInterval = window.setInterval(loadDeadlines, 30_000);
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [students]);

  const handleAddDeadline = async () => {
    if (selectedStudents.length === 0 || !deadlineForm.dueDate) {
      notifyError("Select at least one student and a deadline date.");
      return;
    }
    if (!isPositiveInteger(deadlineForm.monthNumber)) {
      notifyError("Report number must be a positive number.");
      return;
    }
    if (!isFutureDate(deadlineForm.dueDate)) {
      notifyError("Deadline cannot be in the past.");
      return;
    }
    const monthNumber = Number(deadlineForm.monthNumber);
    const duplicateStudents = selectedStudents.filter((student) =>
      deadlines.some(
        (deadline) =>
          deadline.student_id === student.id &&
          deadline.month_number === monthNumber
      )
    );
    if (duplicateStudents.length > 0) {
      notifyError(
        `Deadline already exists for report ${monthNumber}: ${duplicateStudents
          .map((student) => student.name)
          .join(", ")}.`
      );
      return;
    }

    setSavingDeadline(true);
    try {
      const createdDeadlines = await Promise.all(
        selectedStudents.map(async (student) => {
      const response = await authFetch(`${API_BASE}/report_deadlines`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              student_id: student.id,
              student_name: student.name,
              month_number: monthNumber || 1,
              period: getPeriodFromDate(deadlineForm.dueDate),
              due_date: deadlineForm.dueDate,
              report_type: deadlineForm.reportType || "Monthly Logbook",
              status: "pending",
            }),
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.message || `Failed to add deadline for ${student.name}`);
          }
          return result.data as ReportDeadline;
        })
      );
      setDeadlines((prev) =>
        [...createdDeadlines, ...prev].sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )
      );
      setDeadlineForm((form) => ({
        ...form,
        monthNumber: String(Number(form.monthNumber) + 1),
        dueDate: "",
      }));
      notifySuccess(`Report deadline added for ${createdDeadlines.length} student(s).`);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to add deadline.");
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleDeleteDeadline = async (id: string) => {
    try {
      const response = await authFetch(`${API_BASE}/report_deadlines/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to delete deadline");
      setDeadlines((prev) => prev.filter((deadline) => deadline.id !== id));
      notifySuccess("Deadline deleted.");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to delete deadline.");
    }
  };

  return (
    <ContentCard title="Report Deadlines">
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <Select
          label="Filter by Academic Year"
          selectedKeys={[academicYearFilter]}
          onSelectionChange={(keys) => setAcademicYearFilter(String(Array.from(keys)[0] ?? "all"))}
          variant="bordered"
          radius="lg"
          aria-label="Academic year filter"
          className="max-w-xs"
        >
          {academicYearOptions.map((year) => (
            <SelectItem key={year}>{year === "all" ? "All Academic Years" : year}</SelectItem>
          ))}
        </Select>
        <p className="text-sm text-text-secondary">
          Showing <span className="font-semibold text-primary">{visibleDeadlines.length}</span> of {deadlines.filter((deadline) => studentIds.has(deadline.student_id)).length} deadlines
        </p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-[1.4fr_0.7fr_1fr_auto] md:items-end">
        <Select
          label="Students"
          placeholder="Select students"
          selectionMode="multiple"
          selectedKeys={deadlineForm.studentIds}
          onSelectionChange={(keys) => {
            const values = keys === "all" ? students.map((student) => student.id) : (Array.from(keys) as string[]);
            setDeadlineForm((form) => ({ ...form, studentIds: values }));
          }}
          variant="bordered"
          radius="lg"
        >
          {students.map((student) => (
            <SelectItem key={student.id} textValue={student.name}>
              {student.name} ({student.studentId})
            </SelectItem>
          ))}
        </Select>
        <Input
          label="Report No."
          type="number"
          min={1}
          value={deadlineForm.monthNumber}
          onValueChange={(value) => setDeadlineForm((form) => ({ ...form, monthNumber: value }))}
          variant="bordered"
          radius="lg"
          isInvalid={!!deadlineForm.monthNumber && !isPositiveInteger(deadlineForm.monthNumber)}
          errorMessage="Report number must be positive."
        />
        <Input
          label="Due Date"
          type="date"
          value={deadlineForm.dueDate}
          onValueChange={(value) => setDeadlineForm((form) => ({ ...form, dueDate: value }))}
          variant="bordered"
          radius="lg"
          isInvalid={!!deadlineForm.dueDate && !isFutureDate(deadlineForm.dueDate)}
          errorMessage="Deadline cannot be in the past."
        />
        <Button
          color="primary"
          radius="lg"
          startContent={<Plus size={16} />}
          isLoading={savingDeadline}
          onPress={handleAddDeadline}
        >
          Add{selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ""}
        </Button>
      </div>

      <Table aria-label="Report deadlines" removeWrapper>
        <TableHeader>
          <TableColumn>Student Name</TableColumn>
          <TableColumn>Student ID</TableColumn>
          <TableColumn>Academic Year</TableColumn>
          <TableColumn>Report No.</TableColumn>
          <TableColumn>Deadline</TableColumn>
          <TableColumn>Current Status</TableColumn>
          <TableColumn>Manage</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No report deadlines scheduled.">
          {visibleDeadlines.map((deadline) => (
            <TableRow key={deadline.id}>
              <TableCell>{deadline.student_name ?? deadline.student_id}</TableCell>
              <TableCell>{studentById.get(deadline.student_id)?.studentId ?? "—"}</TableCell>
              <TableCell>{studentById.get(deadline.student_id)?.academicYear ?? "—"}</TableCell>
              <TableCell>{deadline.month_number}</TableCell>
              <TableCell>{formatDate(deadline.due_date)}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={deadline.status === "pending" ? "warning" : "success"}>
                  {deadline.status}
                </Chip>
              </TableCell>
              <TableCell>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  aria-label="Delete deadline"
                  onPress={() => handleDeleteDeadline(deadline.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContentCard>
  );
}
