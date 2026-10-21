import bcrypt from "bcrypt";
import { supabase } from "../config/supabase.js";
import { sendStudentNotificationEmail } from "../config/mailer.js";

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const isValidPhone = (value = "") => /^\d{10}$/.test(String(value));
const isValidStudentId = (value = "") => /^\d{6}$/.test(String(value));
const isValidGpa = (value) => value === null || value === "" || (Number(value) >= 0 && Number(value) <= 4);
const isValidGender = (value) =>
  value === null || value === "" || ["Mr.", "Mrs."].includes(String(value).trim());
const isValidDateString = (value) =>
  value === undefined || value === null || value === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());

function validateUserPayload(payload) {
  if (payload.email !== undefined && !isValidEmail(payload.email)) {
    return "Email must be valid and include @ sign";
  }
  if (payload.phone !== undefined && payload.phone !== null && payload.phone !== "" && !isValidPhone(payload.phone)) {
    return "Phone number must be exactly 10 numbers";
  }
  if (payload.student_id !== undefined && payload.student_id !== null && payload.student_id !== "" && !isValidStudentId(payload.student_id)) {
    return "Student ID must be exactly 6 digits, for example 222111";
  }
  if (payload.gpa !== undefined && !isValidGpa(payload.gpa)) {
    return "GPA must be between 0.00 and 4.00";
  }
  if (payload.gender !== undefined && !isValidGender(payload.gender)) {
    return "Gender must be Mr. or Mrs.";
  }
  if (payload.academic_year !== undefined && payload.academic_year !== null && String(payload.academic_year).length > 20) {
    return "Academic year is too long";
  }
  if (!isValidDateString(payload.internship_start_date) || !isValidDateString(payload.internship_end_date)) {
    return "Internship duration dates must be valid dates (YYYY-MM-DD)";
  }
  if (
    payload.internship_start_date &&
    payload.internship_end_date &&
    String(payload.internship_start_date) > String(payload.internship_end_date)
  ) {
    return "Internship start date cannot be after the end date";
  }
  const permissions = payload.permissions ?? {};
  if (
    permissions.internship_months_completed != null &&
    permissions.internship_total_months != null &&
    Number(permissions.internship_months_completed) > Number(permissions.internship_total_months)
  ) {
    return "Months completed cannot be greater than total internship duration";
  }
  if (permissions.internship_total_months != null && Number(permissions.internship_total_months) > 24) {
    return "Total internship duration must be between 1 and 24 months";
  }
  return null;
}

const safeUser = (user) => {
  if (!user) return user;
  const { password_hash, ...withoutPassword } = user;
  return withoutPassword;
};

const canAccessUser = (req, id) => req.user.role === "admin" || req.user.role === "supervisor" || req.user.id === id;

const allowedUpdateFields = new Set([
  "name", "email", "phone", "avatar_url", "faculty", "department", "department_code",
  "student_id", "program", "year", "gpa", "batch", "title", "internship_status",
  "internship_company", "internship_role", "cv_url", "cv_file_name", "supervisor_id",
  "allocation_status", "permissions", "password", "gender", "academic_year",
  "internship_start_date", "internship_end_date", "approval_access",
]);

export const listUsers = async (req, res) => {
  try {
    if (!['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, message: error.message, error });
    res.json({ success: true, data: (data ?? []).map(safeUser) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!canAccessUser(req, id)) return res.status(403).json({ success: false, message: "Access denied" });
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error) return res.status(404).json({ success: false, message: error.message });
    res.json({ success: true, data: safeUser(data) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!canAccessUser(req, id)) return res.status(403).json({ success: false, message: "Access denied" });
    const payload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedUpdateFields.has(key)));
    if (Object.prototype.hasOwnProperty.call(req.body, "password_hash")) {
      return res.status(400).json({ success: false, message: "Use password, not password_hash" });
    }
    if (req.user.role !== "admin") {
      // Non-admin users cannot modify admin-only fields
      for (const field of ["supervisor_id", "allocation_status", "approval_access"]) {
        delete payload[field];
      }
    }
    
    // Check if student is trying to update internship details (company/role) without "active" status
    if (req.user.role === "student" && (payload.internship_company !== undefined || payload.internship_role !== undefined)) {
      const isChangingToActive = payload.internship_status === "active";
      if (!isChangingToActive) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("internship_status")
          .eq("id", req.user.id)
          .single();
        
        if (userError) {
          return res.status(500).json({ success: false, message: userError.message });
        }
        
        if (userData?.internship_status !== "active") {
          return res.status(403).json({ 
            success: false, 
            message: "Please update your internship status to Active before updating internship details. Go to Profile -> Internship Details." 
          });
        }
      }
    }
    
    const validationError = validateUserPayload(payload);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (payload.password) {
      payload.password_hash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }
    const { data: previousUser } = await supabase
      .from("users")
      .select("id, name, email, role, supervisor_id")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return res.status(400).json({ success: false, message: error.message });
    if (!data) return res.status(404).json({ success: false, message: "User not found" });

    const wasAssigned = previousUser?.supervisor_id;
    const isNowAssigned = data.role === "student" && data.supervisor_id;
    if (isNowAssigned && isNowAssigned !== wasAssigned && data.email) {
      const message = "An administrator has assigned a supervisor to you. Please sign in to view your supervisor details.";
      sendStudentNotificationEmail({
        to: data.email,
        name: data.name,
        subject: "Supervisor Assigned",
        message,
      }).catch((mailError) => console.error("Supervisor assignment email failed:", mailError.message));
    }
    res.json({ success: true, data: safeUser(data) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!['student', 'supervisor'].includes(payload.role)) {
      return res.status(400).json({ success: false, message: "Only student or supervisor accounts can be created here" });
    }
    const validationError = validateUserPayload(payload);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (payload.password) {
      payload.password_hash = await bcrypt.hash(payload.password, 10);
      delete payload.password;
    }
    const { data, error } = await supabase.from("users").insert([payload]).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data: safeUser(data) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
