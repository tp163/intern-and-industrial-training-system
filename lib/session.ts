const SESSION_KEY = "itp_user";
const TOKEN_KEY = "authToken";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "supervisor" | "external_supervisor" | "admin";
  // student
  studentId?: string;
  supervisorId?: string;
  department?: string;
  departmentCode?: string;
  program?: string;
  year?: number;
  gpa?: number;
  batch?: string;
  phone?: string;
  faculty?: string;
  gender?: string;
  academicYear?: string;
  internshipStartDate?: string;
  internshipEndDate?: string;
  internshipStatus?: string;
  internshipCompany?: string;
  internshipRole?: string;
  cvFileName?: string;
  // supervisor
  title?: string;
  assignedStudents?: number;
  // external supervisor
  approvalAccess?: boolean;
  // admin
  permissions?: string[];
};

export function saveSession(user: SessionUser): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    // Remove legacy shared-tab session data so old logins cannot override this tab.
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function saveAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Maps a raw DB row (snake_case) to a SessionUser (camelCase). */
export function mapDbUser(db: Record<string, unknown>): SessionUser {
  return {
    id: db.id as string,
    name: db.name as string,
    email: db.email as string,
    role: db.role as SessionUser["role"],
    studentId: (db.student_id ?? undefined) as string | undefined,
    supervisorId: (db.supervisor_id ?? undefined) as string | undefined,
    department: ((db.department ?? db.department_code) ?? undefined) as string | undefined,
    departmentCode: (db.department_code ?? undefined) as string | undefined,
    program: (db.program ?? undefined) as string | undefined,
    year: (db.year ?? undefined) as number | undefined,
    gpa: (db.gpa ?? undefined) as number | undefined,
    batch: (db.batch ?? undefined) as string | undefined,
    phone: (db.phone ?? undefined) as string | undefined,
    faculty: (db.faculty ?? undefined) as string | undefined,
    gender: (db.gender ?? undefined) as string | undefined,
    academicYear: (db.academic_year ?? undefined) as string | undefined,
    internshipStartDate: (db.internship_start_date ?? undefined) as string | undefined,
    internshipEndDate: (db.internship_end_date ?? undefined) as string | undefined,
    internshipStatus: (db.internship_status ?? undefined) as string | undefined,
    internshipCompany: (db.internship_company ?? undefined) as string | undefined,
    internshipRole: (db.internship_role ?? undefined) as string | undefined,
    cvFileName: (db.cv_file_name ?? undefined) as string | undefined,
    title: (db.title ?? undefined) as string | undefined,
    assignedStudents: (db.assigned_students ?? undefined) as number | undefined,
    approvalAccess: db.approval_access === false ? false : true,
    permissions: (db.permissions ?? undefined) as string[] | undefined,
  };
}
