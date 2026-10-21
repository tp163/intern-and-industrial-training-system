export type UserRole = "student" | "supervisor" | "external_supervisor" | "admin";

export type ApplicationStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type InternshipPlacementStatus = "active" | "pending" | "not_placed";

export type DepartmentCategory = "CMIS" | "IMGT" | "ELTN" | "MATH & STAT";

/** Logbook report lifecycle */
export type LogbookReportStatus =
  | "pending"
  | "unreviewed"
  | "reviewed"
  | "accepted"
  | "rejected";

export type NotificationAudience = "student" | "admin" | "supervisor";

export type NotificationCategory =
  | "report_submitted"
  | "report_reviewed"
  | "report_accepted"
  | "report_rejected"
  | "report_feedback"
  | "deadline"
  | "internship"
  | "profile"
  | "announcement"
  | "allocation"
  | "company"
  | "general";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  faculty?: string;
  department?: string;
  createdAt: string;
}

export type AllocationStatus = "allocated" | "unassigned" | "pending";

export interface Student extends User {
  role: "student";
  studentId: string;
  title?: string;
  program: string;
  year: number;
  gpa?: number;
  cvUrl?: string;
  cvFileName?: string;
  supervisorId?: string;
  allocationStatus?: AllocationStatus;
  departmentCode?: string;
  batch?: string;
  /** Salutation: "Mr." or "Mrs." */
  gender?: string;
  /** e.g. "2020/2021" */
  academicYear?: string;
  /** Internship duration — start date (YYYY-MM-DD) */
  internshipStartDate?: string;
  /** Internship duration — end date (YYYY-MM-DD) */
  internshipEndDate?: string;
  internshipStatus?: InternshipPlacementStatus;
  internshipCompany?: string;
  internshipRole?: string;
  /** How many months the student has completed so far */
  internshipMonthsCompleted?: number;
  /** Total internship duration in months */
  internshipTotalMonths?: number;
}

export interface Supervisor extends User {
  role: "supervisor";
  title: string;
  assignedStudents: number;
}

export interface Admin extends User {
  role: "admin";
  permissions: string[];
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  email: string;
  phone: string;
  website?: string;
  status: "pending" | "approved" | "rejected";
  logo?: string;
  description: string;
  companyLetter?: string;
  createdAt: string;
}

export interface Internship {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  type: "remote" | "onsite" | "hybrid";
  duration: string;
  deadline: string;
  description: string;
  requirements: string[];
  slots: number;
  applied: number;
  status: "open" | "closed" | "draft";
  stipend?: string;
  departmentCategory?: DepartmentCategory;
  departmentCategories?: DepartmentCategory[];
}

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  internshipId: string;
  internshipTitle: string;
  companyName: string;
  status: ApplicationStatus;
  appliedAt: string;
  coverLetter?: string;
  cvUrl?: string;
  documentUrl?: string;
  documentFileName?: string;
  documentPath?: string;
}

export interface Review {
  id: string;
  studentId: string;
  studentName: string;
  supervisorId: string;
  title: string;
  type: "weekly" | "midterm" | "final" | "daily_log";
  submittedAt: string;
  status: ReviewStatus;
  content: string;
  feedback?: string;
  score?: number;
  /** Additional information attached to a daily entry (any file format) */
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface LogbookReport {
  id: string;
  studentId: string;
  studentName: string;
  supervisorId: string;
  monthNumber: number;
  period: string;
  monthKey: string;
  reportType?: "fortnightly" | "monthly";
  submittedAt: string;
  status: LogbookReportStatus;
  excerpt: string;
  pdfUrl?: string;
  pdfFileName?: string;
  feedback?: string;
  marks?: number;
  reviewedAt?: string;
  isCurrent?: boolean;
}

/** @deprecated Use LogbookReport */
export type MonthlyReportStatus = LogbookReportStatus;

/** @deprecated Use LogbookReport */
export interface MonthlyReport extends Omit<LogbookReport, "studentName" | "supervisorId" | "monthKey" | "submittedAt"> {
  rating?: number;
}

export interface ProgressReport {
  id: string;
  studentId: string;
  studentName: string;
  week: number;
  submittedAt: string;
  status: ReviewStatus;
  summary: string;
  achievements: string[];
  challenges: string[];
}

export interface DashboardStat {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
}

export interface NavItem {
  id?: string;
  label: string;
  href: string;
  icon: string;
}

export interface AppNotification {
  id: string;
  audience: NotificationAudience;
  userId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: "info" | "success" | "warning" | "error";
  category: NotificationCategory;
}

/** @deprecated Use AppNotification */
export type Notification = AppNotification;

export type AnnouncementPriority = "normal" | "important" | "urgent";
export type AnnouncementTarget = "all_students" | "supervisor_students" | "single_student" | "specific_students";
export type AnnouncementAuthorRole = "admin" | "supervisor";
export type AnnouncementCategory = "workshop" | "general" | "internship" | "deadline" | "reminder";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  authorId: string;
  authorName: string;
  authorRole: AnnouncementAuthorRole;
  priority: AnnouncementPriority;
  target: AnnouncementTarget;
  supervisorId?: string;
  studentId?: string;
  studentIds?: string[];
  isPersonal?: boolean;
  linkUrl?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  category: AnnouncementCategory;
}

export interface SystemSetting {
  id: string;
  label: string;
  description: string;
  value: string | boolean | number;
  type: "text" | "boolean" | "number" | "select";
  options?: string[];
}

/** Form C — Details of Industrial Training Completed */
export interface FormCData {
  traineeName: string;
  registrationNumber: string;
  emailAddress: string;
  contactAddress: string;
  contactTelephone: string;
  residentialAddress: string;
  residentialTelephone: string;
  trainingStage: "first_time" | "repeat";
  periodFrom: string;
  periodTo: string;
  trainingEstablishment: string;
  trainingDescription: Array<{
    division: string;
    durationWeeks: string;
    natureOfTraining: string;
    certifyingOfficer: string;
  }>;
  workComments: string;
  conductComments: string;
  attendanceComments: string;
  authorisedLeaveDays: string;
  unauthorisedLeaveDays: string;
  officerInCharge: string;
  officerDesignation: string;
  dateSigned: string;
}

/** Generated monthly report content (personal information + daily logs) */
export interface MonthlyReportData {
  studentName: string;
  registrationNumber: string;
  program: string;
  academicYear: string;
  emailAddress: string;
  telephone: string;
  trainingEstablishment: string;
  internshipRole: string;
  month: string;
  periodFrom: string;
  periodTo: string;
  entries: Array<{ date: string; hours: number; summary: string }>;
  totalHours: number;
  totalEntries: number;
}
