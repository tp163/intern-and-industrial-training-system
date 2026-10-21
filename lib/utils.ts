import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const formFieldClassNames = {
  inputWrapper: "border-border bg-surface-card shadow-none rounded-input",
  input: "text-text-primary placeholder:text-text-secondary",
  label: "text-text-primary",
};

export function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return /^\d{10}$/.test(value);
}

export function isValidStudentId(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export function isValidPassword(value: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

export function isValidGpa(value: string): boolean {
  if (!/^\d(?:\.\d{1,2})?$/.test(value.trim())) return false;
  const numeric = Number(value);
  return numeric >= 0 && numeric <= 4;
}

export function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

export function isFutureDate(value: string): boolean {
  if (!value) return false;
  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected >= today;
}

export function isValidReportPeriod(value: string): boolean {
  return value.trim().length > 0;
}

export type FortnightHalf = "H1" | "H2";

/**
 * Interim (fortnightly) reports are filtered per half-month: the first half
 * runs from the 1st to the 15th, the second half from the 16th to the month
 * end — so each month yields two reporting periods.
 */
export function getFortnightOf(dateLike: string | Date): { key: string; monthKey: string; half: FortnightHalf } | null {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const half: FortnightHalf = date.getDate() <= 15 ? "H1" : "H2";
  return { key: `${year}-${month}-${half}`, monthKey: `${year}-${month}`, half };
}

export function getFortnightLabel(key: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const match = /^(\d{4})-(\d{2})-(H[12])$/.exec(key);
  if (!match) return key;
  const [, year, month, half] = match;
  const monthName = months[Number(month) - 1] ?? month;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return half === "H1"
    ? `${monthName} ${year} · First Half (01–15)`
    : `${monthName} ${year} · Second Half (16–${String(lastDay).padStart(2, "0")})`;
}

/** Human label for an academic-year style month key, e.g. "2026-10" → "October 2026". */
export function getMonthKeyLabel(monthKey: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const [, year, month] = match;
  return `${months[Number(month) - 1] ?? month} ${year}`;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_CV_BYTES = 5 * 1024 * 1024;

const INTERN_SUBMISSION_ALLOWED_STATUSES = new Set(["active"]);

export function canStudentSubmitByInternshipStatus(status?: string | null): boolean {
  if (!status) return false;
  return INTERN_SUBMISSION_ALLOWED_STATUSES.has(String(status).trim().toLowerCase());
}

export const internshipStatusSubmissionWarning =
  "Please update your internship status to Active before submitting. Go to Profile -> Internship Details.";

export const passwordRequirementText =
  "Password must be at least 8 characters and include uppercase, lowercase, and numbers.";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): "success" | "warning" | "danger" | "default" | "primary" {
  const map: Record<string, "success" | "warning" | "danger" | "default" | "primary"> = {
    approved: "success",
    open: "success",
    active: "success",
    not_placed: "danger",
    pending: "warning",
    reviewing: "warning",
    draft: "default",
    rejected: "danger",
    closed: "danger",
    withdrawn: "default",
  };
  return map[status] ?? "default";
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
