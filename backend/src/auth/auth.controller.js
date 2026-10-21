import { supabase } from "../config/supabase.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { sendPasswordResetCode } from "../config/mailer.js";
import { normalizeDepartment } from "../utils/departments.js";

// In-memory reset token store: email → { code, expires }
const resetTokens = new Map();

const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
const isValidPassword = (value = "") => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(value));
const isValidStudentId = (value = "") => /^\d{6}$/.test(String(value));
// REGISTER
export const register = async (req, res) => {

  try {

    const { name, email, password, role, student_id, department, program, year, batch, title, academic_year, gender } = req.body;

    if (!['student', 'supervisor', 'external_supervisor'].includes(role)) {
      return res.status(400).json({ success: false, message: "A valid registration role is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Email must be valid and include @ sign" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and include uppercase, lowercase, and numbers",
      });
    }

    if (role === "student" && !isValidStudentId(student_id)) {
      return res.status(400).json({ success: false, message: "Student ID must be exactly 6 digits, for example 222111" });
    }

    const duplicateFilter =
      role === "student"
        ? `email.eq.${email},student_id.eq.${student_id}`
        : `email.eq.${email}`;
    const { data: existingUsers, error: lookupError } = await supabase
      .from("users")
      .select("id,name,email,role,student_id")
      .or(duplicateFilter);

    if (lookupError) {
      return res.status(400).json({ success: false, message: lookupError.message });
    }

    if ((existingUsers ?? []).some((user) => user.email?.toLowerCase() === String(email).toLowerCase())) {
      return res.status(400).json({ success: false, message: "An account with this email already exists" });
    }

    if (
      role === "student" &&
      (existingUsers ?? []).some((user) => user.student_id === student_id)
    ) {
      return res.status(400).json({ success: false, message: "An account with this student ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const departmentCode = normalizeDepartment(department);

    const insertData = {
      name,
      email: email.trim().toLowerCase(),
      password_hash: hashedPassword,
      role,
      internship_status: role === "student" ? "not_placed" : null,
      student_id: role === "student" ? student_id : null,
      department: departmentCode,
      department_code: role === "student" ? departmentCode : null,
      program: role === "student" ? program || null : null,
      year: role === "student" ? year || null : null,
      batch: role === "student" ? batch || null : null,
      academic_year: role === "student" ? academic_year || null : null,
      gender: role === "student" && ["Mr.", "Mrs."].includes(gender) ? gender : null,
      title: role === "supervisor" || role === "external_supervisor" ? title || null : null,
    };

    const { data, error } = await supabase
      .from("users")
      .insert([insertData]);

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    await supabase.from("notifications").insert([{
      audience: "admin",
      user_id: null,
      title: "New User Registered",
      message: `${name} registered as ${role}${role === "student" && student_id ? ` with Student ID ${student_id}` : ""}.`,
      read: false,
      type: "info",
      category: "profile",
    }]);

    res.status(201).json({ success: true, message: "User registered successfully" });

  } catch (err) {

    res.status(500).json({ success: false, message: err.message });

  }

};


// FORGOT PASSWORD — generates a 6-digit OTP and sends it by email.
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required" });
    }
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (!user) {
      return res.json({ success: true, message: "If an account exists, a password reset code has been sent" });
    }
    const code = crypto.randomInt(100000, 1000000).toString();
    await sendPasswordResetCode({ to: user.email, name: user.name, code });
    resetTokens.set(email.trim().toLowerCase(), { code, expires: Date.now() + 15 * 60 * 1000 });
    res.json({ success: true, message: "A password reset code has been sent to your email address" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to send the reset code. Please try again later." });
  }
};

// RESET PASSWORD — validates OTP then updates password_hash
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "A valid email address is required" });
    }
    if (!code || String(code).trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Please enter the 6-digit reset code" });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and include uppercase, lowercase, and numbers",
      });
    }
    const key = email.trim().toLowerCase();
    const tokenData = resetTokens.get(key);
    if (!tokenData) {
      return res.status(400).json({ success: false, message: "No reset code found. Please request a new one." });
    }
    if (Date.now() > tokenData.expires) {
      resetTokens.delete(key);
      return res.status(400).json({ success: false, message: "Reset code has expired. Please request a new one." });
    }
    if (tokenData.code !== String(code).trim()) {
      return res.status(400).json({ success: false, message: "Invalid reset code" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from("users").update({ password_hash: hashedPassword }).eq("email", key);
    if (error) return res.status(500).json({ success: false, message: error.message });
    resetTokens.delete(key);
    res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// LOGIN
export const login = async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Email must be valid and include @ sign" });
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    if (!data.password_hash) {
      return res.status(400).json({ success: false, message: "User password is not set" });
    }

    const validPassword = await bcrypt.compare(password, data.password_hash);

    if (!validPassword) {
      return res.status(400).json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: data.id, role: data.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: data.id,
        user_id: data.id,
        name: data.name,
        email: data.email,
        role: data.role
      }
    });

  } catch (err) {

    res.status(500).json({ success: false, message: err.message });

  }

};
