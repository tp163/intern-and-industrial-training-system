"use client";



import { getSession, mapDbUser, saveSession, type SessionUser } from "@/lib/session";
import { authFetch } from "@/lib/auth-fetch";
import { apiCreateReview, apiUpdateReview, apiDeleteReview } from "@/lib/api";
import { normalizeDepartment, normalizeDepartments } from "@/lib/departments";
import { getInternshipPermissions } from "@/lib/internship-progress";
import type {
  Announcement,
  AnnouncementAuthorRole,
  AnnouncementPriority,
  AnnouncementTarget,
  AppNotification,
  Company,
  Application,
  Internship,
  LogbookReport,
  LogbookReportStatus,
  NotificationCategory,
  Student,
  Supervisor,
  Review,
  ReviewStatus,
} from "@/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  useEffect,
} from "react";

// ─── Supabase row → frontend type mappers ────────────────────────────────────

function mapCompanyRow(row: Record<string, unknown>): Company {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    industry: String(row.industry ?? ""),
    location: String(row.location ?? ""),
    email: String(row.email || row.company_email || row.contact_email || row.email_address || ""),
    phone: String(row.phone ?? ""),
    website: row.website ? String(row.website) : undefined,
    status: (row.status as Company["status"]) ?? "pending",
    description: String(row.description ?? ""),
    companyLetter: row.company_letter ? String(row.company_letter) : undefined,
    createdAt: String((row.created_at as string ?? "").slice(0, 10)),
  };
}

function getDepartmentCode(row: Record<string, unknown>): string | undefined {
  const explicitCode = row.department_code ?? row.departmentCode;
  return normalizeDepartment(explicitCode ? String(explicitCode) : row.department ? String(row.department) : "");
}

function mapStudentRow(row: Record<string, unknown>): Student {
  const perms = getInternshipPermissions(row.permissions);
  const supervisorId = row.supervisor_id ?? row.supervisorId;
  const allocationStatus = row.allocation_status ?? row.allocationStatus;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: "student",
    studentId: String(row.student_id ?? row.studentId ?? (row.id as string ?? "").slice(0, 8).toUpperCase()),
    title: row.title ? String(row.title) : undefined,
    program: String(row.program ?? row.department ?? ""),
    year: Number(row.year ?? 1),
    gpa: row.gpa != null ? Number(row.gpa) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    faculty: row.faculty ? String(row.faculty) : undefined,
    department: getDepartmentCode(row),
    departmentCode: getDepartmentCode(row),
    batch: row.batch ? String(row.batch) : undefined,
    internshipStatus: ((row.internship_status ?? row.internshipStatus) as Student["internshipStatus"]) ?? "not_placed",
    internshipCompany: row.internship_company || row.internshipCompany ? String(row.internship_company ?? row.internshipCompany) : undefined,
    internshipRole: row.internship_role || row.internshipRole ? String(row.internship_role ?? row.internshipRole) : undefined,
    supervisorId: supervisorId ? String(supervisorId) : undefined,
    allocationStatus: (allocationStatus as Student["allocationStatus"]) ?? (supervisorId ? "allocated" : "unassigned"),
    cvUrl: row.cv_url || row.cvUrl ? String(row.cv_url ?? row.cvUrl) : undefined,
    cvFileName: row.cv_file_name || row.cvFileName ? String(row.cv_file_name ?? row.cvFileName) : undefined,
    gender: row.gender ? String(row.gender) : undefined,
    academicYear: row.academic_year || row.academicYear ? String(row.academic_year ?? row.academicYear) : undefined,
    internshipStartDate: row.internship_start_date || row.internshipStartDate ? String(row.internship_start_date ?? row.internshipStartDate) : undefined,
    internshipEndDate: row.internship_end_date || row.internshipEndDate ? String(row.internship_end_date ?? row.internshipEndDate) : undefined,
    internshipMonthsCompleted: perms.internship_months_completed != null ? Number(perms.internship_months_completed) : undefined,
    internshipTotalMonths: perms.internship_total_months != null ? Number(perms.internship_total_months) : undefined,
    createdAt: String(((row.created_at ?? row.createdAt) as string ?? "").slice(0, 10)),
  };
}

function mapSupervisorRow(row: Record<string, unknown>): Supervisor {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    role: "supervisor",
    title: String(row.title ?? "Faculty Supervisor"),
    phone: row.phone ? String(row.phone) : undefined,
    faculty: row.faculty ? String(row.faculty) : undefined,
    department: normalizeDepartment(row.department ? String(row.department) : undefined),
    assignedStudents: Number(row.assigned_students ?? row.assignedStudents ?? 0),
    createdAt: String((row.created_at as string ?? "").slice(0, 10)),
  };
}

function mapInternshipRow(row: Record<string, unknown>): Internship {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    companyId: String(row.company_id ?? row.companyId ?? ""),
    companyName: String(row.company_name ?? row.companyName ?? ""),
    location: String(row.location ?? ""),
    type: (row.type as Internship["type"]) ?? "onsite",
    duration: String(row.duration ?? ""),
    deadline: String((row.deadline as string ?? "").slice(0, 10)),
    description: String(row.description ?? ""),
    requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
    slots: Number(row.slots ?? 0),
    applied: Number(row.applied ?? 0),
    status: (row.status as Internship["status"]) ?? "draft",
    stipend: row.stipend ? String(row.stipend) : undefined,
    departmentCategories: normalizeDepartments(row.department_categories ?? row.department_category),
    departmentCategory: normalizeDepartments(row.department_categories ?? row.department_category)[0],
  };
}

function mapApplicationRow(row: Record<string, unknown>): Application {
  return {
    id: String(row.id ?? ""),
    studentId: String(row.student_id ?? row.studentId ?? ""),
    studentName: String(row.student_name ?? row.studentName ?? ""),
    internshipId: String(row.internship_id ?? row.internshipId ?? ""),
    internshipTitle: String(row.internship_title ?? row.internshipTitle ?? ""),
    companyName: String(row.company_name ?? row.companyName ?? ""),
    status: (row.status as Application["status"]) ?? "pending",
    appliedAt: String(row.applied_at ?? row.appliedAt ?? row.created_at ?? ""),
    coverLetter: row.cover_letter ? String(row.cover_letter) : undefined,
    cvUrl: row.cv_url || row.cvUrl ? String(row.cv_url ?? row.cvUrl) : undefined,
    documentUrl: row.document_url || row.documentUrl ? String(row.document_url ?? row.documentUrl) : undefined,
    documentFileName: row.document_file_name || row.documentFileName ? String(row.document_file_name ?? row.documentFileName) : undefined,
    documentPath: row.document_path || row.documentPath ? String(row.document_path ?? row.documentPath) : undefined,
  };
}

function mapLogbookReportRow(row: Record<string, unknown>): LogbookReport {
  return {
    id: String(row.id ?? ""),
    studentId: String(row.student_id ?? row.studentId ?? ""),
    studentName: String(row.student_name ?? row.studentName ?? ""),
    supervisorId: String(row.supervisor_id ?? row.supervisorId ?? ""),
    monthNumber: Number(row.month_number ?? row.monthNumber ?? 0),
    period: String(row.period ?? row["Report Name"] ?? row.report_name ?? ""),
    monthKey: String(row.month_key ?? row.monthKey ?? ""),
    reportType: (row.report_type ?? row.reportType) === "monthly" ? "monthly" : "fortnightly",
    submittedAt: String(row.submitted_at ?? row.submittedAt ?? ""),
    status: (row.status as LogbookReportStatus) ?? "pending",
    excerpt: String(row.excerpt ?? ""),
    pdfUrl: row.pdf_url || row.pdfUrl ? String(row.pdf_url ?? row.pdfUrl) : undefined,
    pdfFileName: row.pdf_file_name || row.pdfFileName ? String(row.pdf_file_name ?? row.pdfFileName) : undefined,
    feedback: row.feedback ? String(row.feedback) : undefined,
    marks: row.marks != null ? Number(row.marks) : undefined,
    reviewedAt: row.reviewed_at || row.reviewedAt ? String(row.reviewed_at ?? row.reviewedAt) : undefined,
    isCurrent: Boolean(row.is_current ?? row.isCurrent ?? false),
  };
}

function mapReviewRow(row: Record<string, unknown>): Review {
  const dbType = String(row.type ?? "");
  const title = String(row.title ?? "");
  let type = dbType as Review["type"];
  let cleanTitle = title;

  if (title.startsWith("Daily Log: ")) {
    type = "daily_log";
    cleanTitle = title.replace("Daily Log: ", "");
  }

  return {
    id: String(row.id ?? ""),
    studentId: String(row.student_id ?? row.studentId ?? ""),
    studentName: String(row.student_name ?? row.studentName ?? ""),
    supervisorId: String(row.supervisor_id ?? row.supervisorId ?? ""),
    title: cleanTitle,
    type,
    submittedAt: String(row.submitted_at ?? row.submittedAt ?? ""),
    status: (row.status as Review["status"]) ?? "pending",
    content: String(row.content ?? ""),
    feedback: row.feedback ? String(row.feedback) : undefined,
    score: row.score != null ? Number(row.score) : undefined,
    attachmentUrl: row.attachment_url || row.attachmentUrl ? String(row.attachment_url ?? row.attachmentUrl) : undefined,
    attachmentName: row.attachment_name || row.attachmentName ? String(row.attachment_name ?? row.attachmentName) : undefined,
  };
}

function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id ?? ""),
    audience: (row.audience as AppNotification["audience"]) ?? "student",
    userId: row.user_id || row.userId ? String(row.user_id ?? row.userId) : undefined,
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    read: Boolean(row.read ?? false),
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    type: (row.type as AppNotification["type"]) ?? "info",
    category: (row.category as AppNotification["category"]) ?? "general",
  };
}

function mapAnnouncementRow(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    authorId: String(row.author_id ?? row.authorId ?? ""),
    authorName: String(row.author_name ?? row.authorName ?? ""),
    authorRole: (row.author_role as AnnouncementAuthorRole) ?? (row.authorRole as AnnouncementAuthorRole) ?? "admin",
    priority: (row.priority as AnnouncementPriority) ?? "normal",
    target: (row.target as AnnouncementTarget) ?? "all_students",
    supervisorId: row.supervisor_id || row.supervisorId ? String(row.supervisor_id ?? row.supervisorId) : undefined,
    studentId: row.student_id || row.studentId ? String(row.student_id ?? row.studentId) : undefined,
    studentIds: row.student_ids || row.studentIds ? (Array.isArray(row.student_ids ?? row.studentIds) ? (row.student_ids ?? row.studentIds) as string[] : []) : undefined,
    isPersonal: Boolean(row.is_personal ?? row.isPersonal),
    linkUrl: row.link_url || row.linkUrl ? String(row.link_url ?? row.linkUrl) : undefined,
    attachmentName: row.attachment_name || row.attachmentName ? String(row.attachment_name ?? row.attachmentName) : undefined,
    attachmentUrl: row.attachment_url || row.attachmentUrl ? String(row.attachment_url ?? row.attachmentUrl) : undefined,
    scheduledAt: row.scheduled_at || row.scheduledAt ? String(row.scheduled_at ?? row.scheduledAt) : undefined,
    publishedAt: row.published_at || row.publishedAt ? String(row.published_at ?? row.publishedAt) : undefined,
    createdAt: String(row.created_at ?? row.createdAt ?? ""),
    category: (row.category as Announcement["category"]) ?? "general",
  };
}

// ─────────────────────────────────────────────────────────────────────────────

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
  return period;
}

function deriveAllocationStatus(supervisorId?: string): Student["allocationStatus"] {
  return supervisorId ? "allocated" : "unassigned";
}

const studentChangeLabels: Partial<Record<keyof Student, string>> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  title: "Title",
  faculty: "Faculty",
  department: "Faculty",
  departmentCode: "Department",
  program: "Degree program",
  year: "Year",
  gpa: "GPA",
  internshipStatus: "Internship status",
  internshipCompany: "Internship company",
  internshipRole: "Internship role",
  internshipMonthsCompleted: "Internship months completed",
  internshipTotalMonths: "Internship total months",
  gender: "Gender",
  academicYear: "Academic year",
  internshipStartDate: "Internship start date",
  internshipEndDate: "Internship end date",
  cvFileName: "CV file",
  cvUrl: "CV link",
};

function formatStudentValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not set";
  return String(value);
}

function describeStudentChanges(student: Student | undefined, patch: Partial<Student>): string {
  const rows = (Object.keys(patch) as (keyof Student)[])
    .filter((key) => studentChangeLabels[key])
    .map((key) => {
      const before = formatStudentValue(student?.[key]);
      const after = formatStudentValue(patch[key]);
      if (before === after) return null;
      return `${studentChangeLabels[key]} changed to ${after}`;
    })
    .filter(Boolean);

  return rows.length > 0 ? rows.join("\n") : `${student?.name ?? "Student"} made an update.`;
}

interface AppStoreValue {
  companies: Company[];
  students: Student[];
  supervisors: Supervisor[];
  internships: Internship[];
  applications: Application[];
  announcements: Announcement[];
  logbookReports: LogbookReport[];
  notifications: AppNotification[];
  addCompany: (company: Omit<Company, "id" | "createdAt">) => void;
  updateCompany: (id: string, patch: Partial<Company>) => void;
  removeCompany: (id: string) => void;
  addSupervisor: (supervisor: Supervisor) => void;
  submitApplication: (input: {
    studentId: string;
    studentName: string;
    internshipId: string;
    internshipTitle: string;
    companyName: string;
    coverLetter?: string;
    cvUrl?: string;
    documentUrl?: string;
    documentFileName?: string;
    documentPath?: string;
  }) => Promise<Application>;
  updateSupervisor: (id: string, patch: Partial<Supervisor>) => void;
  removeSupervisor: (id: string) => void;
  removeStudent: (id: string) => void;
  getApprovedCompanies: () => Company[];
  submitLogbookReport: (input: {
    id?: string;
    studentId: string;
    period: string;
    excerpt: string;
    pdfUrl: string;
    pdfFileName: string;
  }) => LogbookReport;
  reviewLogbookReport: (input: {
    reportId: string;
    status: "accepted" | "rejected" | "pending";
    marks?: number;
    feedback?: string;
  }) => void;
  deleteLogbookReport: (reportId: string) => void;
  updateStudentRecord: (
    studentId: string,
    patch: Partial<Student>,
    changeType: string
  ) => void;
  addStudent: (student: Student) => void;
  getStudentById: (id: string) => Student | undefined;
  getReportsForStudent: (studentId: string) => LogbookReport[];
  getReportsForSupervisor: (supervisorId: string) => LogbookReport[];
  getNotificationsFor: (audience: AppNotification["audience"], userId?: string) => AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (audience: AppNotification["audience"], userId?: string) => void;
  allocateStudents: (studentIds: string[], supervisorId: string | null) => Promise<void>;
  loadRealData: () => Promise<void>;
  getSupervisorById: (id: string) => Supervisor | undefined;
  getStudentsBySupervisor: (supervisorId: string) => Student[];
  getAssignedSupervisorForStudent: (studentId: string) => Supervisor | undefined;
  publishAnnouncement: (input: {
    title: string;
    message: string;
    priority: AnnouncementPriority;
    target: AnnouncementTarget;
    authorId: string;
    authorName: string;
    authorRole: AnnouncementAuthorRole;
    supervisorId?: string;
    linkUrl?: string;
    attachmentName?: string;
    attachmentUrl?: string;
    scheduledAt?: string;
    category?: Announcement["category"];
  }) => Announcement;
  addPersistedAnnouncement: (row: Record<string, unknown>) => Announcement;
  removeAnnouncement: (id: string) => void;
  getPublishedAnnouncementsForStudent: (studentId: string) => Announcement[];
  getAllAnnouncements: () => Announcement[];
  adminProfile: { name: string; email: string; phone: string; title: string };
  updateAdminProfile: (patch: Partial<{ name: string; email: string; phone: string; title: string }>) => void;
  currentUser: SessionUser | null;
  updateCurrentUser: (patch: Partial<SessionUser>) => void;
  reviews: Review[];
  submitDailyLog: (input: { id?: string; studentId: string; title: string; content: string; score?: number }) => Promise<Review>;
  updateDailyLogStatus: (id: string, status: ReviewStatus, feedback?: string) => Promise<void>;
  deleteDailyLog: (id: string) => Promise<void>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [internships, setInternships] = useState<Internship[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [adminProfile, setAdminProfile] = useState({
    name: "Admin",
    email: "admin@example.com",
    phone: "",
    title: "Faculty Administrator",
  });

  const updateAdminProfile = useCallback(
    (patch: Partial<{ name: string; email: string; phone: string; title: string }>) =>
      setAdminProfile((prev) => ({ ...prev, ...patch })),
    []
  );

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setCurrentUser(getSession());
  }, []);

  const updateCurrentUser = useCallback((patch: Partial<SessionUser>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [logbookReports, setLogbookReports] = useState<LogbookReport[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [reviews, setReviews] = useState<Review[]>([])

  const pushNotification = useCallback((n: Omit<AppNotification, "id" | "read" | "createdAt">) => {
    const entry: AppNotification = {
      ...n,
      id: `not-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [entry, ...prev]);
    authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: entry.audience,
        user_id: entry.userId ?? null,
        title: entry.title,
        message: entry.message,
        read: entry.read,
        created_at: entry.createdAt,
        type: entry.type,
        category: entry.category,
      }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (!json?.success || !json.data?.id) return;
        const saved = mapNotificationRow(json.data);
        setNotifications((prev) =>
          prev.map((item) => (item.id === entry.id ? saved : item))
        );
      })
      .catch(() => {});
  }, []);

  const notifyStudentById = useCallback(
    (
      studentId: string,
      title: string,
      message: string,
      category: NotificationCategory,
      type: AppNotification["type"] = "info"
    ) => {
      pushNotification({
        audience: "student",
        userId: studentId,
        title,
        message,
        type,
        category,
      });
    },
    [pushNotification]
  );

  const notifyStudent = useCallback(
    (
      title: string,
      message: string,
      category: NotificationCategory,
      type: AppNotification["type"] = "info",
      studentId: string = (currentUser?.id ?? "")
    ) => {
      notifyStudentById(studentId, title, message, category, type);
    },
    [notifyStudentById]
  );

  const notifyAdmin = useCallback(
    (title: string, message: string, category: NotificationCategory, type: AppNotification["type"] = "info") => {
      pushNotification({
        audience: "admin",
        title,
        message,
        type,
        category,
      });
    },
    [pushNotification]
  );

  const broadcastCompanyChange = useCallback(
    (action: string, companyName: string) => {
      notifyStudent(
        "Company Directory Updated",
        `Administrator ${action} company "${companyName}" in the directory.`,
        "company",
        "info"
      );
      pushNotification({
        audience: "supervisor",
        title: "Company Directory Updated",
        message: `Company "${companyName}" was ${action} by administration.`,
        type: "info",
        category: "company",
      });
    },
    [notifyStudent, pushNotification]
  );

  const addCompany = useCallback(
    (company: Omit<Company, "id" | "createdAt">) => {
      const entry: Company = {
        ...company,
        id: `com-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setCompanies((prev) => [...prev, entry]);
      broadcastCompanyChange("added", entry.name);
    },
    [broadcastCompanyChange]
  );

  const updateCompany = useCallback(
    (id: string, patch: Partial<Company>) => {
      setCompanies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );
      const name = patch.name ?? companies.find((c) => c.id === id)?.name ?? "Company";
      broadcastCompanyChange("updated", name);
    },
    [broadcastCompanyChange, companies]
  );

  const removeCompany = useCallback(
    (id: string) => {
      const name = companies.find((c) => c.id === id)?.name ?? "Company";
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      broadcastCompanyChange("removed", name);
    },
    [broadcastCompanyChange, companies]
  );

  const getApprovedCompanies = useCallback(
    () => companies.filter((c) => c.status === "approved"),
    [companies]
  );

  const addSupervisor = useCallback(
    (supervisor: Supervisor) => setSupervisors((prev) => [...prev, supervisor]),
    []
  );

  const submitApplication = useCallback(
    async (input: {
      studentId: string;
      studentName: string;
      internshipId: string;
      internshipTitle: string;
      companyName: string;
      coverLetter?: string;
      cvUrl?: string;
      documentUrl?: string;
      documentFileName?: string;
      documentPath?: string;
    }) => {
      const payload = {
        student_id: input.studentId,
        student_name: input.studentName,
        internship_id: input.internshipId,
        internship_title: input.internshipTitle,
        company_name: input.companyName,
        status: "pending",
        cover_letter: input.coverLetter ?? "",
        cv_url: input.cvUrl,
        document_url: input.documentUrl,
        document_file_name: input.documentFileName,
        document_path: input.documentPath,
      };
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to submit application");
      const entry = mapApplicationRow(json.data);
      setApplications((prev) => [entry, ...prev.filter((application) => application.id !== entry.id)]);
      if (!json.reused) {
        setInternships((prev) =>
          prev.map((i) => (i.id === input.internshipId ? { ...i, applied: i.applied + 1 } : i))
        );
      }
      return entry;
    },
    []
  );

  const updateSupervisor = useCallback(
    (id: string, patch: Partial<Supervisor>) =>
      setSupervisors((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    []
  );

  const removeSupervisor = useCallback(
    (id: string) => setSupervisors((prev) => prev.filter((s) => s.id !== id)),
    []
  );

  const removeStudent = useCallback(
    (id: string) => setStudents((prev) => prev.filter((s) => s.id !== id)),
    []
  );

  const submitLogbookReport = useCallback(
    (input: { id?: string; studentId: string; period: string; excerpt: string; pdfUrl: string; pdfFileName: string }) => {
      const student = students.find((s) => s.id === input.studentId) ?? (currentUser as unknown as Student);
      const nextNum =
        Math.max(
          ...logbookReports.filter((r) => r.studentId === input.studentId).map((r) => r.monthNumber),
          0
        ) + 1;

      const entry: LogbookReport = {
        id: input.id ?? `mr-${Date.now()}`,
        studentId: input.studentId,
        studentName: student.name,
        supervisorId: student.supervisorId ?? "",
        monthNumber: nextNum,
        period: input.period.trim(),
        monthKey: periodToMonthKey(input.period),
        submittedAt: new Date().toISOString(),
        status: "pending",
        excerpt: input.excerpt.trim(),
        pdfUrl: input.pdfUrl,
        pdfFileName: input.pdfFileName,
        isCurrent: true,
      };

      setLogbookReports((prev) => [
        ...prev.map((r) =>
          r.studentId === input.studentId ? { ...r, isCurrent: false } : r
        ),
        entry,
      ]);

      notifyStudent(
        "Report Submitted Successfully",
        `Your monthly report for ${entry.period} has been submitted and is awaiting supervisor review.`,
        "report_submitted",
        "success"
      );

      if (entry.supervisorId) {
        pushNotification({
          audience: "supervisor",
          userId: entry.supervisorId,
          title: "New Logbook Submission",
          message: `${student.name} submitted the ${entry.period} report (PDF).`,
          type: "warning",
          category: "report_submitted",
        });
      }

      return entry;
    },
    [logbookReports, notifyStudent, pushNotification, students]
  );

  const reviewLogbookReport = useCallback(
    (input: { reportId: string; status: "accepted" | "rejected" | "pending"; marks?: number; feedback?: string }) => {
      setLogbookReports((prev) =>
        prev.map((r) =>
          r.id === input.reportId
            ? {
                ...r,
                status: input.status,
                marks: input.status === "pending" ? undefined : input.marks,
                feedback: input.status === "pending" ? undefined : input.feedback,
                reviewedAt: input.status === "pending" ? undefined : new Date().toISOString(),
              }
            : r
        )
      );

      if (input.status === "pending") return;

      const report = logbookReports.find((r) => r.id === input.reportId);
      if (!report) return;

      const isAccepted = input.status === "accepted";
      const sid = report.studentId;
      notifyStudent(
        isAccepted ? "Report Accepted" : "Report Rejected",
        `Your ${report.period} report has been ${input.status}. Marks: ${input.marks}. ${input.feedback ? "See supervisor comments in your logbook." : ""}`,
        isAccepted ? "report_accepted" : "report_rejected",
        isAccepted ? "success" : "error",
        sid
      );

      if (input.feedback) {
        notifyStudent("Supervisor Feedback", input.feedback, "report_feedback", "info", sid);
      }

      notifyStudent(
        "Report Review Completed",
        `Supervisor reviewed your ${report.period} submission on ${new Date().toLocaleString()}.`,
        "report_reviewed",
        "info",
        sid
      );
    },
    [logbookReports, notifyStudent]
  );

  const addStudent = useCallback((student: Student) => {
    setStudents((prev) => {
      if (prev.some((s) => s.studentId === student.studentId)) return prev;
      return [...prev, { ...student, allocationStatus: deriveAllocationStatus(student.supervisorId) }];
    });
  }, []);

  const updateStudentRecord = useCallback(
    (studentId: string, patch: Partial<Student>, changeType: string) => {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ...patch } : s))
      );
      // Persist to DB in the background so the UI stays responsive.
      const apiPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) apiPatch.name = patch.name;
      if (patch.email !== undefined) apiPatch.email = patch.email;
      if (patch.phone !== undefined) apiPatch.phone = patch.phone;
      if (patch.title !== undefined) apiPatch.title = patch.title;
      if (patch.faculty !== undefined) apiPatch.faculty = patch.faculty;
      if (patch.department !== undefined) apiPatch.department = patch.department;
      if (patch.departmentCode !== undefined) apiPatch.department_code = patch.departmentCode;
      if (patch.batch !== undefined) apiPatch.batch = patch.batch;
      if (patch.program !== undefined) apiPatch.program = patch.program;
      if (patch.year !== undefined) apiPatch.year = patch.year;
      if (patch.gpa !== undefined) apiPatch.gpa = patch.gpa;
      if (patch.internshipStatus !== undefined) apiPatch.internship_status = patch.internshipStatus;
      if (patch.internshipCompany !== undefined) apiPatch.internship_company = patch.internshipCompany;
      if (patch.internshipRole !== undefined) apiPatch.internship_role = patch.internshipRole;
      if (patch.gender !== undefined) apiPatch.gender = patch.gender;
      if (patch.academicYear !== undefined) apiPatch.academic_year = patch.academicYear;
      if (patch.internshipStartDate !== undefined) apiPatch.internship_start_date = patch.internshipStartDate || null;
      if (patch.internshipEndDate !== undefined) apiPatch.internship_end_date = patch.internshipEndDate || null;
      if (patch.supervisorId !== undefined) apiPatch.supervisor_id = patch.supervisorId;
      if (patch.allocationStatus !== undefined) apiPatch.allocation_status = patch.allocationStatus;
      if (Object.prototype.hasOwnProperty.call(patch, "cvUrl")) apiPatch.cv_url = patch.cvUrl ?? null;
      if (Object.prototype.hasOwnProperty.call(patch, "cvFileName")) apiPatch.cv_file_name = patch.cvFileName ?? null;
      if (Object.keys(apiPatch).length > 0) {
        authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/users/${studentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPatch),
        }).catch(() => {});
      }
      const student = students.find((s) => s.id === studentId);
      const name = student?.name ?? "Student";
      const when = new Date().toLocaleString();
      const details = describeStudentChanges(student, patch);
      notifyAdmin(
        "Student Profile Updated",
        `${name} updated ${changeType} on ${when}.\n${details}`,
        "profile",
        "warning"
      );
    },
    [notifyAdmin, students]
  );

  const getStudentById = useCallback(
    (id: string) => students.find((s) => s.id === id),
    [students]
  );

  const deleteLogbookReport = useCallback(
    (reportId: string) => {
      setLogbookReports((prev) => prev.filter((r) => r.id !== reportId));
    },
    []
  );

  const submitDailyLog = useCallback(
    async (input: { id?: string; studentId: string; title: string; content: string; score?: number }) => {
      const student = students.find((s) => s.id === input.studentId);
      const payload = {
        student_id: input.studentId,
        student_name: student?.name ?? currentUser?.name ?? "",
        supervisor_id: student?.supervisorId ?? null,
        title: `Daily Log: ${input.title}`,
        type: "weekly",
        status: "pending",
        content: input.content,
        score: input.score ?? null,
      };

      let result;
      if (input.id) {
        result = await apiUpdateReview(input.id, payload);
      } else {
        result = await apiCreateReview(payload);
      }

      if (!result.success || !result.data) {
        throw new Error("Failed to submit daily log");
      }

      const mapped = mapReviewRow(result.data);
      setReviews((prev) => {
        const filtered = prev.filter((r) => r.id !== mapped.id);
        return [mapped, ...filtered];
      });

      return mapped;
    },
    [students, currentUser]
  );

  const updateDailyLogStatus = useCallback(
    async (id: string, status: ReviewStatus, feedback?: string) => {
      const payload: Record<string, any> = { status };
      if (feedback !== undefined) payload.feedback = feedback;

      const result = await apiUpdateReview(id, payload);
      if (!result.success || !result.data) {
        throw new Error("Failed to update daily log status");
      }

      const mapped = mapReviewRow(result.data);
      setReviews((prev) => prev.map((r) => (r.id === id ? mapped : r)));
    },
    []
  );

  const deleteDailyLog = useCallback(
    async (id: string) => {
      const result = await apiDeleteReview(id);
      if (!result.success) {
        throw new Error("Failed to delete daily log");
      }
      setReviews((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  const getReportsForStudent = useCallback(
    (studentId: string) =>
      [...logbookReports]
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => b.monthNumber - a.monthNumber),
    [logbookReports]
  );

  const getReportsForSupervisor = useCallback(
    (supervisorId: string) =>
      [...logbookReports]
        .filter((r) => {
          if (r.supervisorId === supervisorId) return true;
          const student = students.find((s) => s.id === r.studentId);
          return student?.supervisorId === supervisorId;
        })
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [logbookReports, students]
  );

  const getNotificationsFor = useCallback(
    (audience: AppNotification["audience"], userId?: string) =>
      notifications
        .filter(
          (n) =>
            n.audience === audience &&
            (!userId || !n.userId || n.userId === userId)
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/notifications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }, []);

  const markAllNotificationsRead = useCallback(
    (audience: AppNotification["audience"], userId?: string) => {
      setNotifications((prev) => {
        const affectedIds: string[] = [];
        const next = prev.map((n) => {
          const shouldMark =
            n.audience === audience && (!userId || !n.userId || n.userId === userId);
          if (shouldMark && !n.read) affectedIds.push(n.id);
          return shouldMark ? { ...n, read: true } : n;
        });
        affectedIds.forEach((id) => {
          authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/notifications/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          }).catch(() => {});
        });
        return next;
      });
    },
    []
  );

  const recalcSupervisorCounts = useCallback((list: Student[]) => {
    setSupervisors((prev) =>
      prev.map((sup) => ({
        ...sup,
        assignedStudents: list.filter((s) => s.supervisorId === sup.id).length,
      }))
    );
  }, []);

  const allocateStudents = useCallback(
    async (studentIds: string[], supervisorId: string | null) => {
      const supervisor = supervisorId
        ? supervisors.find((s) => s.id === supervisorId)
        : undefined;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

      await Promise.all(
        studentIds.map(async (id) => {
          const response = await authFetch(`${apiBase}/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supervisor_id: supervisorId ?? null,
              allocation_status: supervisorId ? "allocated" : "unassigned",
            }),
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.success) {
            throw new Error(result?.message || "Failed to save supervisor allocation.");
          }
        })
      );

      await Promise.all(
        logbookReports
          .filter((report) => studentIds.includes(report.studentId))
          .map(async (report) => {
            const response = await authFetch(`${apiBase}/logbook_reports/${report.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ supervisor_id: supervisorId ?? null }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) {
              throw new Error(result?.message || "Failed to save report supervisor allocation.");
            }
          })
      );

      setStudents((prev) => {
        const next = prev.map((s) => {
          if (!studentIds.includes(s.id)) return s;
          return {
            ...s,
            supervisorId: supervisorId ?? undefined,
            allocationStatus: deriveAllocationStatus(supervisorId ?? undefined),
          };
        });
        recalcSupervisorCounts(next);
        return next;
      });

      setLogbookReports((prev) =>
        prev.map((r) =>
          studentIds.includes(r.studentId)
            ? { ...r, supervisorId: supervisorId ?? "" }
            : r
        )
      );

      const label = supervisor?.name ?? "Unassigned";
      studentIds.forEach((id) => {
        const st = students.find((s) => s.id === id);
        notifyStudentById(
          id,
          supervisorId ? "Supervisor Assigned" : "Supervisor Assignment Removed",
          supervisorId
            ? `You have been allocated to ${label}.`
            : "Your supervisor assignment has been removed by administration.",
          "allocation",
          supervisorId ? "success" : "warning"
        );
      });

      if (supervisorId) {
        pushNotification({
          audience: "supervisor",
          userId: supervisorId,
          title: "Students Allocated",
          message: `${studentIds.length} student(s) assigned to you by administration.`,
          type: "info",
          category: "allocation",
        });
      }

      notifyAdmin(
        "Allocation Updated",
        `${studentIds.length} student(s) ${supervisorId ? `assigned to ${label}` : "unassigned"}.`,
        "allocation",
        "info"
      );

    },
    [
      supervisors,
      students,
      logbookReports,
      recalcSupervisorCounts,
      notifyStudentById,
      pushNotification,
      notifyAdmin,
    ]
  );

  const getSupervisorById = useCallback(
    (id: string) => supervisors.find((s) => s.id === id),
    [supervisors]
  );

  const getStudentsBySupervisor = useCallback(
    (supervisorId: string) => students.filter((s) => s.supervisorId === supervisorId),
    [students]
  );

  const getAssignedSupervisorForStudent = useCallback(
    (studentId: string) => {
      const st = students.find((s) => s.id === studentId);
      if (!st?.supervisorId) return undefined;
      return supervisors.find((s) => s.id === st.supervisorId);
    },
    [students, supervisors]
  );

  const getTargetStudentIds = useCallback(
    (target: AnnouncementTarget, supervisorId?: string) => {
      if (target === "all_students") return students.map((s) => s.id);
      if (!supervisorId) return [];
      return students.filter((s) => s.supervisorId === supervisorId).map((s) => s.id);
    },
    [students]
  );

  const publishAnnouncement = useCallback(
    (input: {
      title: string;
      message: string;
      priority: AnnouncementPriority;
      target: AnnouncementTarget;
      authorId: string;
      authorName: string;
      authorRole: AnnouncementAuthorRole;
      supervisorId?: string;
      linkUrl?: string;
      attachmentName?: string;
      attachmentUrl?: string;
      scheduledAt?: string;
      category?: Announcement["category"];
    }) => {
      const now = new Date();
      const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
      const isScheduledFuture = scheduled && scheduled > now;

      const entry: Announcement = {
        id: `ann-${Date.now()}`,
        title: input.title.trim(),
        message: input.message.trim(),
        authorId: input.authorId,
        authorName: input.authorName,
        authorRole: input.authorRole,
        priority: input.priority,
        target: input.target,
        supervisorId: input.supervisorId,
        linkUrl: input.linkUrl,
        attachmentName: input.attachmentName,
        attachmentUrl: input.attachmentUrl,
        scheduledAt: input.scheduledAt,
        publishedAt: isScheduledFuture ? undefined : now.toISOString(),
        createdAt: now.toISOString(),
        category: input.category ?? "general",
      };

      setAnnouncements((prev) => [entry, ...prev]);

      if (!isScheduledFuture) {
        const targetIds = getTargetStudentIds(input.target, input.supervisorId);
        targetIds.forEach((studentId) => {
          notifyStudentById(
            studentId,
            `New Announcement: ${entry.title}`,
            entry.message.slice(0, 120) + (entry.message.length > 120 ? "…" : ""),
            "announcement",
            entry.priority === "urgent" ? "warning" : "info"
          );
        });
      }

      return entry;
    },
    [getTargetStudentIds, notifyStudentById]
  );

  const addPersistedAnnouncement = useCallback((row: Record<string, unknown>) => {
    const entry = mapAnnouncementRow(row);
    setAnnouncements((prev) => [entry, ...prev.filter((a) => a.id !== entry.id)]);
    return entry;
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== id));
  }, []);

  const isAnnouncementVisibleToStudent = useCallback(
    (a: Announcement, student: Student) => {
      const now = new Date();
      if (a.scheduledAt && new Date(a.scheduledAt) > now) return false;
      if (!a.publishedAt && a.scheduledAt) return false;
      if (a.target === "all_students") return true;
      return (
        a.target === "supervisor_students" &&
        !!student.supervisorId &&
        student.supervisorId === a.supervisorId
      ) || (a.target === "specific_students" && a.studentIds?.includes(student.id));
    },
    []
  );

  const getPublishedAnnouncementsForStudent = useCallback(
    (studentId: string) => {
      const storedStudent = students.find((s) => s.id === studentId);
      const sessionStudent = currentUser?.role === "student" && currentUser.id === studentId
        ? ({ id: currentUser.id } as Student)
        : undefined;
      const student = storedStudent
        ? { ...storedStudent }
        : sessionStudent;
      return announcements
        .filter((a) => {
          if (!student) return a.target === "all_students";
          return isAnnouncementVisibleToStudent(a, student);
        })
        .filter((a) => a.publishedAt || !a.scheduledAt || new Date(a.scheduledAt) <= new Date())
        .sort(
          (a, b) =>
            new Date(b.publishedAt ?? b.createdAt).getTime() -
            new Date(a.publishedAt ?? a.createdAt).getTime()
        );
    },
    [announcements, currentUser, students, isAnnouncementVisibleToStudent]
  );

  const getAllAnnouncements = useCallback(
    () =>
      [...announcements].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [announcements]
  );


  // Load real data from backend API and populate the store
  const loadRealData = useCallback(async () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

    const safeFetch = async (url: string) => {
      try {
        const r = await authFetch(url);
        if (!r.ok) return { success: false, data: [] };
        return r.json();
      } catch {
        return { success: false, data: [] };
      }
    };

    const [companiesRes, studentsRes, supervisorsRes, internshipsRes, applicationsRes, announcementsRes, reportsRes, notificationsRes, reviewsRes] =
      await Promise.all([
        safeFetch(`${base}/companies`),
        safeFetch(`${base}/students`),
        safeFetch(`${base}/supervisors`),
        safeFetch(`${base}/internships`),
        safeFetch(`${base}/applications`),
        safeFetch(`${base}/announcements`),
        safeFetch(`${base}/logbook_reports`),
        safeFetch(`${base}/notifications`),
        safeFetch(`${base}/reviews`),
      ]);

    if (companiesRes.success) setCompanies((companiesRes.data ?? []).map(mapCompanyRow));
    if (studentsRes.success) setStudents((studentsRes.data ?? []).map(mapStudentRow));
    if (supervisorsRes.success) setSupervisors((supervisorsRes.data ?? []).map(mapSupervisorRow));
    if (internshipsRes.success) setInternships((internshipsRes.data ?? []).map(mapInternshipRow));
    if (applicationsRes.success) setApplications((applicationsRes.data ?? []).map(mapApplicationRow));
    if (announcementsRes.success) setAnnouncements((announcementsRes.data ?? []).map(mapAnnouncementRow));
    if (reportsRes.success) setLogbookReports((reportsRes.data ?? []).map(mapLogbookReportRow));
    if (notificationsRes.success) setNotifications((notificationsRes.data ?? []).map(mapNotificationRow));
    if (reviewsRes.success) setReviews((reviewsRes.data ?? []).map(mapReviewRow));

    const sessionUser = getSession();
    if (sessionUser?.id) {
      const userRes = await safeFetch(`${base}/users/${sessionUser.id}`);
      if (userRes.success && userRes.data?.id) {
        const nextUser = mapDbUser(userRes.data);
        setCurrentUser(nextUser);
        saveSession(nextUser);

        if (nextUser.role === "student") {
          const student = mapStudentRow(userRes.data);
          setStudents((prev) => [
            student,
            ...prev.filter((item) => item.id !== student.id),
          ]);
        }

        if (nextUser.role === "supervisor") {
          const supervisor = mapSupervisorRow(userRes.data);
          setSupervisors((prev) => [
            supervisor,
            ...prev.filter((item) => item.id !== supervisor.id),
          ]);
        }
      }
    }
  }, []);

  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  const value = useMemo(
    () => ({
      companies,
      students,
      supervisors,
      internships,
      applications,
      announcements,
      logbookReports,
      notifications,
      addCompany,
      updateCompany,
      removeCompany,
      addSupervisor,
      submitApplication,
      updateSupervisor,
      removeSupervisor,
      removeStudent,
      getApprovedCompanies,
      submitLogbookReport,
      reviewLogbookReport,
      deleteLogbookReport,
      updateStudentRecord,
      addStudent,
      getStudentById,
      getReportsForStudent,
      getReportsForSupervisor,
      getNotificationsFor,
      markNotificationRead,
      markAllNotificationsRead,
      allocateStudents,
      loadRealData,
      getSupervisorById,
      getStudentsBySupervisor,
      getAssignedSupervisorForStudent,
      publishAnnouncement,
      addPersistedAnnouncement,
      removeAnnouncement,
      getPublishedAnnouncementsForStudent,
      getAllAnnouncements,
      adminProfile,
      updateAdminProfile,
      currentUser,
      updateCurrentUser,
      reviews,
      submitDailyLog,
      updateDailyLogStatus,
      deleteDailyLog,
    }),
    [
      companies,
      students,
      supervisors,
      internships,
      applications,
      announcements,
      logbookReports,
      notifications,
      addCompany,
      updateCompany,
      removeCompany,
      addSupervisor,
      submitApplication,
      updateSupervisor,
      removeSupervisor,
      removeStudent,
      getApprovedCompanies,
      submitLogbookReport,
      reviewLogbookReport,
      deleteLogbookReport,
      updateStudentRecord,
      addStudent,
      getStudentById,
      getReportsForStudent,
      getReportsForSupervisor,
      getNotificationsFor,
      markNotificationRead,
      markAllNotificationsRead,
      allocateStudents,
      loadRealData,
      getSupervisorById,
      getStudentsBySupervisor,
      getAssignedSupervisorForStudent,
      publishAnnouncement,
      addPersistedAnnouncement,
      removeAnnouncement,
      getPublishedAnnouncementsForStudent,
      getAllAnnouncements,
      adminProfile,
      updateAdminProfile,
      currentUser,
      updateCurrentUser,
      reviews,
      submitDailyLog,
      updateDailyLogStatus,
      deleteDailyLog,
    ]
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
