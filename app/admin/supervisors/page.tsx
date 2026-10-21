"use client";

import { AppModal } from "@/components/ui/app-modal";
import { ContentCard, EmptyState, PageHeader } from "@/components/ui/page-header";
import { TableScroll } from "@/components/ui/table-scroll";
import { SearchBar } from "@/components/ui/search-bar";
import { useAppStore } from "@/lib/store/app-store";
import { apiCreateUser, apiUpdateUser, apiDeleteUser } from "@/lib/api";
import { authFetch } from "@/lib/auth-fetch";
import { digitsOnly, formFieldClassNames, getInitials, isValidEmail, isValidPhone } from "@/lib/utils";

const isValidPassword = (v: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(v);
import { notifyError, notifySuccess } from "@/lib/notify";
import type { Supervisor } from "@/types";
import {
  Avatar,
  Button,
  Chip,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { Eye, Pencil, Plus, Trash2, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type ExternalSupervisorRow = {
  id: string;
  name: string;
  email: string;
  title?: string | null;
  approval_access?: boolean | null;
  created_at?: string;
};

export default function AdminSupervisorsPage() {
  const { supervisors, addSupervisor, updateSupervisor, removeSupervisor } = useAppStore();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Supervisor | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    department: "",
    phone: "",
    password: "",
  });

  // External supervisors and their approval-access toggle.
  const [externalSupervisors, setExternalSupervisors] = useState<ExternalSupervisorRow[]>([]);
  const [togglingAccessIds, setTogglingAccessIds] = useState<Record<string, boolean>>({});

  const loadExternalSupervisors = async () => {
    try {
      const response = await authFetch(`${API_BASE}/users`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to load external supervisors");
      setExternalSupervisors(
        (result.data ?? [])
          .filter((user: Record<string, unknown>) => user.role === "external_supervisor")
          .map((user: Record<string, unknown>) => ({
            id: String(user.id),
            name: String(user.name ?? ""),
            email: String(user.email ?? ""),
            title: (user.title as string | null) ?? null,
            approval_access: (user.approval_access as boolean | null) ?? null,
            created_at: user.created_at ? String(user.created_at) : undefined,
          }))
      );
    } catch (err) {
      notifyError("Failed to load external supervisors: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  useEffect(() => {
    void loadExternalSupervisors();
  }, []);

  const toggleApprovalAccess = async (row: ExternalSupervisorRow, nextValue: boolean) => {
    setTogglingAccessIds((prev) => ({ ...prev, [row.id]: true }));
    try {
      await apiUpdateUser(row.id, { approval_access: nextValue });
      setExternalSupervisors((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, approval_access: nextValue } : item))
      );
      notifySuccess(
        nextValue
          ? `${row.name} can now approve weekly certifications and evaluations.`
          : `${row.name} is now view-only in the external supervisor portal.`
      );
    } catch (err) {
      notifyError("Failed to update approval access: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setTogglingAccessIds((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  const filtered = useMemo(() => {
    if (!search) return supervisors;
    const q = search.toLowerCase();
    return supervisors.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
    );
  }, [supervisors, search]);

  const openAdd = () => {
    setForm({ name: "", email: "", title: "", department: "", phone: "", password: "" });
    setShowAdd(true);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      notifyError("Name and email are required.");
      return;
    }
    if (!isValidEmail(form.email)) {
      notifyError("Please enter a valid email address with @ sign.");
      return;
    }
    if (!form.password) {
      notifyError("A temporary password is required so the supervisor can log in.");
      return;
    }
    if (!isValidPassword(form.password)) {
      notifyError("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      notifyError("Phone number must be exactly 10 numbers.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiCreateUser({
        name: form.name,
        email: form.email,
        role: "supervisor",
        title: form.title || null,
        department: form.department || null,
        phone: form.phone || null,
        password: form.password,
      });
      const dbId = (result.data as Record<string, unknown>)?.id as string ?? `sup-${Date.now()}`;
      const newSup: Supervisor = {
        id: dbId,
        name: form.name,
        email: form.email,
        role: "supervisor",
        title: form.title,
        department: form.department,
        phone: form.phone,
        assignedStudents: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      addSupervisor(newSup);
      setShowAdd(false);
      notifySuccess("Supervisor added successfully.");
    } catch (err: unknown) {
      notifyError("Failed to add supervisor: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    if (!isValidEmail(form.email)) {
      notifyError("Please enter a valid email address with @ sign.");
      return;
    }
    if (form.phone && !isValidPhone(form.phone)) {
      notifyError("Phone number must be exactly 10 numbers.");
      return;
    }
    setSaving(true);
    try {
      await apiUpdateUser(selected.id, {
        name: form.name,
        email: form.email,
        title: form.title || null,
        department: form.department || null,
        phone: form.phone || null,
      });
      updateSupervisor(selected.id, { ...form });
      notifySuccess("Supervisor updated.");
      closeDetail();
    } catch (err) {
      notifyError("Failed to update supervisor: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteUser(id);
      removeSupervisor(id);
      setConfirmDeleteId(null);
      notifySuccess("Supervisor removed.");
    } catch (err) {
      notifyError("Failed to remove supervisor: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisor Management"
        description={`${supervisors.length} supervisors in the system`}
        action={
          <Button color="primary" radius="lg" startContent={<Plus size={16} />} onPress={openAdd}>
            Add Supervisor
          </Button>
        }
      />

      <ContentCard>
        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} placeholder="Search supervisors..." />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={28} />}
            title="No supervisors found"
            description="Try a different search or add a new supervisor."
          />
        ) : (
        <TableScroll>
        <Table aria-label="Supervisors table" removeWrapper>
          <TableHeader>
            <TableColumn>SUPERVISOR</TableColumn>
            <TableColumn>TITLE</TableColumn>
            <TableColumn>DEPARTMENT</TableColumn>
            <TableColumn>STUDENTS</TableColumn>
            <TableColumn>ACTIONS</TableColumn>
          </TableHeader>
          <TableBody>
            {filtered.map((supervisor) => (
              <TableRow key={supervisor.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={getInitials(supervisor.name)} size="sm" color="secondary" />
                    <div>
                      <p className="font-medium">{supervisor.name}</p>
                      <p className="text-xs text-text-secondary">{supervisor.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{supervisor.title}</TableCell>
                <TableCell>{supervisor.department ?? "—"}</TableCell>
                <TableCell>{supervisor.assignedStudents}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      isIconOnly size="sm" variant="light" aria-label="View"
                      onPress={() => { setSelected(supervisor); setEditMode(false); }}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      isIconOnly size="sm" variant="light" aria-label="Edit"
                      onPress={() => {
                        setSelected(supervisor);
                        setForm({
                          name: supervisor.name,
                          email: supervisor.email,
                          title: supervisor.title,
                          department: supervisor.department ?? "",
                          phone: supervisor.phone ?? "",
                          password: "",
                        });
                        setEditMode(true);
                      }}
                    >
                      <Pencil size={16} />
                    </Button>
                    {confirmDeleteId === supervisor.id ? (
                      <>
                        <Button size="sm" color="danger" radius="lg" onPress={() => handleDelete(supervisor.id)}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="flat" radius="lg" onPress={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        isIconOnly size="sm" variant="light" color="danger" aria-label="Delete"
                        onPress={() => setConfirmDeleteId(supervisor.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableScroll>
        )}
      </ContentCard>

      <ContentCard title="External Supervisor Access">
        <div className="mb-4">
          <p className="text-sm text-text-secondary">
            Control which external supervisors have approval rights. When approval access is turned off, the external
            supervisor portal becomes <span className="font-medium text-text-primary">view only</span> — they can still
            review submissions but cannot approve, certify or submit evaluations.
          </p>
        </div>
        {externalSupervisors.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title="No external supervisors registered"
            description="External supervisors appear here once they register or are appointed to a trainee."
          />
        ) : (
          <TableScroll>
            <Table aria-label="External supervisors access table" removeWrapper>
              <TableHeader>
                <TableColumn>EXTERNAL SUPERVISOR</TableColumn>
                <TableColumn>TITLE</TableColumn>
                <TableColumn>APPROVAL ACCESS</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody>
                {externalSupervisors.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={getInitials(row.name)} size="sm" color="secondary" />
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-text-secondary">{row.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{row.title ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        isSelected={row.approval_access !== false}
                        isDisabled={togglingAccessIds[row.id]}
                        onValueChange={(nextValue) => void toggleApprovalAccess(row, nextValue)}
                        aria-label={`Toggle approval access for ${row.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip variant="flat" color={row.approval_access !== false ? "success" : "default"}>
                        {row.approval_access !== false ? "Can approve" : "View only"}
                      </Chip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </ContentCard>

      <AppModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Supervisor"
        footer={
          <>
            <Button variant="light" onPress={() => setShowAdd(false)}>Cancel</Button>
            <Button color="primary" isLoading={saving} onPress={handleAdd}>Create Supervisor</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full Name" value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
          <Input label="Email" type="email" value={form.email} onValueChange={(v) => setForm((f) => ({ ...f, email: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} isInvalid={!!form.email && !isValidEmail(form.email)} errorMessage="Email must include @ sign." />
          <Input label="Title" value={form.title} onValueChange={(v) => setForm((f) => ({ ...f, title: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
          <Input label="Department" value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
          <Input label="Phone" value={form.phone} onValueChange={(v) => setForm((f) => ({ ...f, phone: digitsOnly(v, 10) }))} inputMode="numeric" maxLength={10} variant="bordered" radius="lg" classNames={formFieldClassNames} isInvalid={!!form.phone && !isValidPhone(form.phone)} errorMessage="Phone number must be exactly 10 numbers." />
          <Input label="Temporary Password" type="password" placeholder="Min 8 chars, upper, lower, number" value={form.password} onValueChange={(v) => setForm((f) => ({ ...f, password: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} isRequired isInvalid={!!form.password && !isValidPassword(form.password)} errorMessage="Min 8 characters, uppercase, lowercase, and number." description="The supervisor will use this to log in for the first time." />
        </div>
      </AppModal>

      <AppModal
        isOpen={!!selected}
        onClose={closeDetail}
        title={editMode ? "Edit Supervisor" : "Supervisor Details"}
        footer={
          editMode ? (
            <>
              <Button variant="light" onPress={closeDetail}>Cancel</Button>
              <Button color="primary" isLoading={saving} onPress={handleSaveEdit}>Save</Button>
            </>
          ) : (
            <Button variant="light" onPress={closeDetail}>Close</Button>
          )
        }
      >
        {selected && (
          <div className="grid gap-4 sm:grid-cols-2">
            {editMode ? (
              <>
                <Input label="Name" value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
                <Input label="Email" type="email" value={form.email} onValueChange={(v) => setForm((f) => ({ ...f, email: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} isInvalid={!!form.email && !isValidEmail(form.email)} errorMessage="Email must include @ sign." />
                <Input label="Title" value={form.title} onValueChange={(v) => setForm((f) => ({ ...f, title: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
                <Input label="Department" value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))} variant="bordered" radius="lg" classNames={formFieldClassNames} />
                <Input label="Phone" value={form.phone} onValueChange={(v) => setForm((f) => ({ ...f, phone: digitsOnly(v, 10) }))} inputMode="numeric" maxLength={10} variant="bordered" radius="lg" classNames={formFieldClassNames} isInvalid={!!form.phone && !isValidPhone(form.phone)} errorMessage="Phone number must be exactly 10 numbers." />
              </>
            ) : (
              <>
                <p><span className="text-text-secondary">Name:</span> {selected.name}</p>
                <p><span className="text-text-secondary">Email:</span> {selected.email}</p>
                <p><span className="text-text-secondary">Title:</span> {selected.title}</p>
                <p><span className="text-text-secondary">Department:</span> {selected.department ?? "—"}</p>
                <p><span className="text-text-secondary">Students:</span> {selected.assignedStudents}</p>
              </>
            )}
          </div>
        )}
      </AppModal>
    </div>
  );
}
