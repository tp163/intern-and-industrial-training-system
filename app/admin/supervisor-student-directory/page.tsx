"use client";

import { AppModal } from "@/components/ui/app-modal";
import { TableScroll } from "@/components/ui/table-scroll";
import { InternshipStatusPill } from "@/components/supervisor/internship-status-pill";
import { useAppStore } from "@/lib/store/app-store";
import { apiDeleteUser } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getInitials } from "@/lib/utils";
import type { Student } from "@/types";
import { departmentOptions } from "@/lib/departments";
import {
  Avatar,
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
import { ChevronDown, ChevronRight, Eye, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const ALL = "all";

export default function AdminSupervisorStudentDirectoryPage() {
  const { currentUser, students, supervisors, removeStudent, updateStudentRecord } = useAppStore();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(ALL);
  const [batch, setBatch] = useState(ALL);
  const [academicYear, setAcademicYear] = useState(ALL);
  const [supervisorFilter, setSupervisorFilter] = useState(ALL);
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(
    () => new Set(supervisors.map((s) => s.id))
  );
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [confirmDeleteStudentId, setConfirmDeleteStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: "", email: "", phone: "", departmentCode: "", batch: "", academicYear: "", program: "", year: "", gpa: "" });

  const canDelete = currentUser?.role === "admin";

  const departments = useMemo(
    () => [ALL, ...departmentOptions],
    []
  );
  const batches = useMemo(
    () => [ALL, ...Array.from(new Set(students.map((s) => s.batch).filter(Boolean)))],
    [students]
  );
  const academicYears = useMemo(
    () => [ALL, ...Array.from(new Set(students.map((s) => s.academicYear).filter(Boolean)))],
    [students]
  );

  const supervisorMap = Object.fromEntries(supervisors.map((s) => [s.id, s.name]));

  const supervisorFilterOptions = useMemo(
    () => [
      { key: ALL, label: "All Supervisors" },
      { key: "unassigned", label: "Unassigned" },
      ...supervisors.map((s) => ({ key: s.id, label: s.name })),
    ],
    []
  );

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const q = search.toLowerCase();
      const supervisorName = student.supervisorId
        ? supervisorMap[student.supervisorId]?.toLowerCase() ?? ""
        : "";

      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(q) ||
        student.studentId.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        (student.departmentCode?.toLowerCase().includes(q) ?? false) ||
        (student.batch?.toLowerCase().includes(q) ?? false) ||
        (student.academicYear?.toLowerCase().includes(q) ?? false) ||
        supervisorName.includes(q);

      const matchesDepartment =
        department === ALL || student.departmentCode === department;
      const matchesBatch = batch === ALL || student.batch === batch;
      const matchesAcademicYear =
        academicYear === ALL || student.academicYear === academicYear;
      const matchesSupervisor =
        supervisorFilter === ALL ||
        (supervisorFilter === "unassigned"
          ? !student.supervisorId
          : student.supervisorId === supervisorFilter);

      return matchesSearch && matchesDepartment && matchesBatch && matchesAcademicYear && matchesSupervisor;
    });
  }, [students, search, department, batch, academicYear, supervisorFilter, supervisorMap]);

  const groupedBySupervisor = useMemo(() => {
    return supervisors.map((supervisor) => ({
      supervisor,
      students: filteredStudents.filter((s) => s.supervisorId === supervisor.id),
    }));
  }, [filteredStudents]);

  const unassignedStudents = filteredStudents.filter((s) => !s.supervisorId);

  const toggleSupervisor = (id: string) => {
    setExpandedSupervisors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeModal = () => { setSelectedStudent(null); setEditingStudent(false); };
  const openStudent = (student: Student) => { setSelectedStudent(student); setEditingStudent(false); setStudentForm({ name: student.name, email: student.email, phone: student.phone ?? "", departmentCode: student.departmentCode ?? "", batch: student.batch ?? "", academicYear: student.academicYear ?? "", program: student.program ?? "", year: String(student.year ?? ""), gpa: student.gpa == null ? "" : String(student.gpa) }); };
  const saveStudent = () => { if (!selectedStudent || !studentForm.name.trim() || !studentForm.email.trim()) return notifyError("Student name and email are required."); const patch = { name: studentForm.name.trim(), email: studentForm.email.trim(), phone: studentForm.phone.trim() || undefined, departmentCode: studentForm.departmentCode.trim() || undefined, batch: studentForm.batch.trim() || undefined, academicYear: studentForm.academicYear.trim() || undefined, program: studentForm.program.trim() || selectedStudent.program, year: studentForm.year ? Number(studentForm.year) : selectedStudent.year, gpa: studentForm.gpa ? Number(studentForm.gpa) : undefined }; updateStudentRecord(selectedStudent.id, patch, "student details"); setSelectedStudent({ ...selectedStudent, ...patch }); setEditingStudent(false); notifySuccess("Student details updated."); };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-secondary">
          Administration <span className="mx-1 text-text-secondary/60">&gt;</span> Supervisor Student
          Directory
        </p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              Supervisor Student Directory
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              View all supervisors and students assigned to each supervisor across the faculty.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant="flat" color="primary">
              {filteredStudents.length} students · {supervisors.length} supervisors
            </Chip>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border/60 bg-white p-4 shadow-card sm:p-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              size={18}
            />
            <input
              type="search"
              placeholder="Search by Student ID, Name, Department, Batch, or Supervisor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-input border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <Select
            aria-label="Academic year filter"
            selectedKeys={[academicYear]}
            onSelectionChange={(keys) => setAcademicYear((Array.from(keys)[0] as string) ?? ALL)}
            variant="bordered"
            radius="lg"
            className="min-w-[160px]"
            classNames={{ trigger: "border-border bg-white" }}
          >
            {academicYears.map((year) => (
              <SelectItem key={year}>{year === ALL ? "All Academic Years" : year}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Department filter"
            selectedKeys={[department]}
            onSelectionChange={(keys) => setDepartment((Array.from(keys)[0] as string) ?? ALL)}
            variant="bordered"
            radius="lg"
            className="min-w-[150px]"
            classNames={{ trigger: "border-border bg-white" }}
          >
            {departments.map((d) => (
              <SelectItem key={d}>{d === ALL ? "All Departments" : d}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Batch filter"
            selectedKeys={[batch]}
            onSelectionChange={(keys) => setBatch((Array.from(keys)[0] as string) ?? ALL)}
            variant="bordered"
            radius="lg"
            className="min-w-[130px]"
            classNames={{ trigger: "border-border bg-white" }}
          >
            {batches.map((b) => (
              <SelectItem key={b}>{b === ALL ? "All Batches" : b}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Supervisor filter"
            items={supervisorFilterOptions}
            selectedKeys={[supervisorFilter]}
            onSelectionChange={(keys) =>
              setSupervisorFilter((Array.from(keys)[0] as string) ?? ALL)
            }
            variant="bordered"
            radius="lg"
            className="min-w-[180px]"
            classNames={{ trigger: "border-border bg-white" }}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
        </div>
      </div>

      {filteredStudents.length === 0 && (
        <div className="rounded-card border border-border/60 bg-white p-10 text-center shadow-card">
          <p className="font-medium text-text-primary">No students match your filters</p>
          <p className="mt-1 text-sm text-text-secondary">Try adjusting search or filter options.</p>
        </div>
      )}

      <div className="space-y-4">
        {groupedBySupervisor.map(({ supervisor, students: assigned }) => {
          if (assigned.length === 0) return null;
          const isExpanded = expandedSupervisors.has(supervisor.id);

          return (
            <section
              key={supervisor.id}
              className="overflow-hidden rounded-card border border-border/60 bg-white shadow-card"
            >
              <button
                type="button"
                onClick={() => toggleSupervisor(supervisor.id)}
                className="flex w-full items-center justify-between gap-4 border-b border-border/60 bg-surface-muted/50 px-4 py-4 text-left sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown size={18} className="shrink-0 text-text-secondary" />
                  ) : (
                    <ChevronRight size={18} className="shrink-0 text-text-secondary" />
                  )}
                  <Avatar name={getInitials(supervisor.name)} size="sm" color="secondary" />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{supervisor.name}</p>
                    <p className="text-xs text-text-secondary">
                      {supervisor.title} · {supervisor.department}
                    </p>
                  </div>
                </div>
                <Chip size="sm" variant="flat">
                  {assigned.length} student{assigned.length !== 1 ? "s" : ""}
                </Chip>
              </button>

              {isExpanded && (
                <TableScroll>
                  <Table aria-label={`Students for ${supervisor.name}`} removeWrapper>
                    <TableHeader>
                      <TableColumn>STUDENT</TableColumn>
                      <TableColumn>STUDENT ID</TableColumn>
                      <TableColumn>DEPARTMENT</TableColumn>
                      <TableColumn className="hidden sm:table-cell">BATCH</TableColumn>
                      <TableColumn className="hidden md:table-cell">STATUS</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {assigned.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar name={getInitials(student.name)} size="sm" color="primary" />
                              <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-xs text-text-secondary">{student.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{student.studentId}</TableCell>
                          <TableCell>{student.departmentCode ?? "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{student.batch ?? "—"}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {student.internshipStatus ? (
                              <InternshipStatusPill status={student.internshipStatus} />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button isIconOnly size="sm" variant="light" aria-label="View student" onPress={() => openStudent(student)}>
                                <Eye size={16} />
                              </Button>
                              {canDelete && confirmDeleteStudentId === student.id ? (
                                <>
                                  <Button size="sm" color="danger" radius="lg" onPress={async () => { try { await apiDeleteUser(student.id); removeStudent(student.id); setConfirmDeleteStudentId(null); notifySuccess("Student removed."); } catch (err) { notifyError("Failed to remove student: " + (err instanceof Error ? err.message : "Unknown error")); setConfirmDeleteStudentId(null); } }}>Confirm</Button>
                                  <Button size="sm" variant="flat" radius="lg" onPress={() => setConfirmDeleteStudentId(null)}>Cancel</Button>
                                </>
                              ) : canDelete ? (
                                <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete student" onPress={() => setConfirmDeleteStudentId(student.id)}>
                                  <Trash2 size={16} />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              )}
            </section>
          );
        })}

        {unassignedStudents.length > 0 && (
          <section className="overflow-hidden rounded-card border border-border/60 bg-white shadow-card">
            <div className="border-b border-border/60 bg-surface-muted/50 px-4 py-4 sm:px-6">
              <p className="font-semibold text-text-primary">Unassigned Students</p>
              <p className="text-xs text-text-secondary">Students without a supervisor</p>
            </div>
            <TableScroll>
              <Table aria-label="Unassigned students" removeWrapper>
                <TableHeader>
                  <TableColumn>STUDENT</TableColumn>
                  <TableColumn>STUDENT ID</TableColumn>
                  <TableColumn>DEPARTMENT</TableColumn>
                  <TableColumn>BATCH</TableColumn>
                  <TableColumn>ACTIONS</TableColumn>
                </TableHeader>
                <TableBody>
                  {unassignedStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.studentId}</TableCell>
                      <TableCell>{student.departmentCode ?? "—"}</TableCell>
                      <TableCell>{student.batch ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button isIconOnly size="sm" variant="light" aria-label="View student" onPress={() => openStudent(student)}>
                            <Eye size={16} />
                          </Button>
                          {canDelete && confirmDeleteStudentId === student.id ? (
                            <>
                              <Button size="sm" color="danger" radius="lg" onPress={async () => { try { await apiDeleteUser(student.id); removeStudent(student.id); setConfirmDeleteStudentId(null); notifySuccess("Student removed."); } catch (err) { notifyError("Failed to remove student: " + (err instanceof Error ? err.message : "Unknown error")); setConfirmDeleteStudentId(null); } }}>Confirm</Button>
                              <Button size="sm" variant="flat" radius="lg" onPress={() => setConfirmDeleteStudentId(null)}>Cancel</Button>
                            </>
                          ) : canDelete ? (
                            <Button isIconOnly size="sm" variant="light" color="danger" aria-label="Delete student" onPress={() => setConfirmDeleteStudentId(student.id)}>
                              <Trash2 size={16} />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          </section>
        )}
      </div>

      <AppModal
        isOpen={!!selectedStudent}
        onClose={closeModal}
        title={editingStudent ? "Edit Student" : "Student Details"}
        footer={editingStudent ? <><Button variant="light" onPress={() => setEditingStudent(false)}>Cancel</Button><Button color="primary" onPress={saveStudent}>Save changes</Button></> : <><Button variant="light" onPress={closeModal}>Close</Button>{canDelete && <Button color="primary" variant="flat" startContent={<Pencil size={15} />} onPress={() => setEditingStudent(true)}>Edit details</Button>}</>}
      >
        {selectedStudent && (
          editingStudent ? <div className="grid gap-4 sm:grid-cols-2">{([['name','Name','text'],['email','Email','email'],['phone','Phone','text'],['departmentCode','Department','text'],['batch','Batch','text'],['academicYear','Academic Year','text'],['program','Program','text'],['year','Year','number'],['gpa','GPA','number']] as const).map(([key,label,type]) => <Input key={key} label={label} type={type} value={studentForm[key]} onValueChange={(value) => setStudentForm((current) => ({ ...current, [key]: value }))} />)}</div> : <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Name" value={selectedStudent.name} />
            <DetailField label="Student ID" value={selectedStudent.studentId} />
            <DetailField label="Email" value={selectedStudent.email} />
            <DetailField label="Department" value={selectedStudent.departmentCode ?? "—"} />
            <DetailField label="Batch" value={selectedStudent.batch ?? "—"} />
            <DetailField label="Academic Year" value={selectedStudent.academicYear ?? "—"} />
            <DetailField label="Program" value={selectedStudent.program} />
            <DetailField
              label="Supervisor"
              value={selectedStudent.supervisorId ? supervisorMap[selectedStudent.supervisorId] ?? "—" : "Unassigned"}
            />
            <DetailField label="GPA" value={selectedStudent.gpa?.toString() ?? "—"} />
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">CV</p>
              {selectedStudent.cvUrl ? (
                <Button
                  className="mt-2"
                  color="primary"
                  variant="flat"
                  onPress={() => window.open(selectedStudent.cvUrl, "_blank")}
                >
                  View / Download {selectedStudent.cvFileName ?? "CV"}
                </Button>
              ) : (
                <p className="mt-1 text-sm font-medium text-text-primary">No CV uploaded</p>
              )}
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}
