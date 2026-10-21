import { Router } from "express";
import { supabase } from "../config/supabase.js";
import { sendExternalSupervisorAppointmentEmail } from "../config/mailer.js";

const router = Router();
const tables = new Set([
  "weekly_certifications",
  "placement_confirmations",
  "site_visits",
  "meeting_attendance",
  "completion_recommendations",
  "attendance_records",
  "completion_certifications",
  "external_monthly_progress",
  "evaluation_records",
  "training_documents",
  "commencement_confirmations",
  "external_supervisor_appointments",
  "seminar_events",
  "form_c_submissions",
  "monthly_reports",
]);

const externalOwnerColumn = new Set([
  "weekly_certifications",
  "attendance_records",
  "completion_certifications",
  "external_monthly_progress",
]);

const supervisorOwnerColumn = new Set(["evaluation_records"]);
const supervisorStudentResources = new Set([
  "placement_confirmations",
  "commencement_confirmations",
  "weekly_certifications",
  "completion_recommendations",
  "site_visits",
  "meeting_attendance",
  "form_c_submissions",
  "monthly_reports",
]);

// Resources a student may create/update on their own record.
const studentOwnedResources = new Set([
  "weekly_certifications",
  "placement_confirmations",
  "commencement_confirmations",
  "form_c_submissions",
  "monthly_reports",
]);

// Fields a student is allowed to change when editing their own submissions.
// Status transitions such as "certified" belong to external supervisors/admins.
const studentEditableFields = {
  weekly_certifications: ["file_url", "file_name", "week_start_date", "week_end_date", "daily_log_ids"],
  form_c_submissions: ["form_data", "file_url", "file_name", "status", "submitted_at"],
  monthly_reports: ["month_key", "report_data", "file_url", "file_name", "status", "submitted_at"],
};

const getTable = (resource) => resource === "completion_certifications" ? "completion_certifications" : resource;

async function getOwnedQuery(resource, req) {
  let query = supabase.from(getTable(resource)).select("*");
  if (req.user.role === "student") {
    if (resource === "training_documents") {
      query = query.or(`student_id.eq.${req.user.id},student_id.is.null`);
    } else if (studentOwnedResources.has(resource)) {
      query = query.eq("student_id", req.user.id);
    }
  }
  if (req.user.role === "external_supervisor" && externalOwnerColumn.has(resource)) {
    query = query.eq("external_supervisor_id", req.user.id);
  }
  if (req.user.role === "supervisor" && supervisorOwnerColumn.has(resource)) {
    query = query.eq("evaluator_id", req.user.id);
  }
  if (req.user.role === "supervisor" && supervisorStudentResources.has(resource)) {
    const { data: assignedStudents, error } = await supabase.from("users").select("id").eq("supervisor_id", req.user.id);
    if (error) throw error;
    const studentIds = (assignedStudents ?? []).map((student) => student.id);
    query = query.in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  return query;
}

router.get("/:resource", async (req, res) => {
  if (!tables.has(req.params.resource)) return res.status(404).json({ success: false, message: "Unknown training resource" });
  try {
    const { data, error } = await getOwnedQuery(req.params.resource, req);
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/external-supervisor-appointments/send", async (req, res) => {
  if (!['admin', 'supervisor'].includes(req.user.role)) return res.status(403).json({ success: false, message: "Access denied" });
  try {
    const { student_id, placement_confirmation_id, external_supervisor_name, external_supervisor_email, internal_supervisor_id } = req.body;
    const { data: student } = await supabase.from("users").select("name").eq("id", student_id).single();
    const { data: internal } = internal_supervisor_id ? await supabase.from("users").select("name").eq("id", internal_supervisor_id).single() : { data: null };
    await sendExternalSupervisorAppointmentEmail({ to: external_supervisor_email, name: external_supervisor_name, studentName: student?.name ?? "the student", internalSupervisorName: internal?.name, coordinatorName: req.user.name });
    const { data, error } = await supabase.from("external_supervisor_appointments").insert([{ student_id, placement_confirmation_id, external_supervisor_name, external_supervisor_email, internal_supervisor_id, coordinator_id: req.user.id, status: "sent" }]).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.status(201).json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.post("/:resource", async (req, res) => {
  if (!tables.has(req.params.resource)) return res.status(404).json({ success: false, message: "Unknown training resource" });
  const studentResources = new Set(["placement_confirmations", "commencement_confirmations", "weekly_certifications", "form_c_submissions", "monthly_reports"]);
  if (req.user.role !== "external_supervisor" && req.user.role !== "supervisor" && req.user.role !== "admin" && !(req.user.role === "student" && studentResources.has(req.params.resource))) return res.status(403).json({ success: false, message: "Access denied" });
  const payload = { ...req.body };
  if (req.user.role === "student") payload.student_id = req.user.id;
  if (req.user.role === "external_supervisor" && externalOwnerColumn.has(req.params.resource)) payload.external_supervisor_id = req.user.id;
  if (req.user.role === "supervisor" && supervisorOwnerColumn.has(req.params.resource)) payload.evaluator_id = req.user.id;
  if (req.user.role === "student" && req.params.resource === "form_c_submissions") {
    // A student only ever has one Form C record.
    payload.status = payload.status === "submitted" ? "submitted" : "draft";
  }
  if (req.user.role === "student" && req.params.resource === "monthly_reports") {
    payload.status = payload.status === "submitted" ? "submitted" : "draft";
  }
  let operation = supabase.from(req.params.resource).insert([payload]);
  if (["completion_certifications", "evaluation_records", "form_c_submissions"].includes(req.params.resource)) operation = supabase.from(req.params.resource).upsert([payload], { onConflict: "student_id" });
  if (req.params.resource === "monthly_reports") operation = supabase.from(req.params.resource).upsert([payload], { onConflict: "student_id,month_key" });
  const { data, error } = await operation.select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.status(201).json({ success: true, data });
});


router.put("/:resource/:id", async (req, res) => {
  if (!tables.has(req.params.resource)) return res.status(404).json({ success: false, message: "Unknown training resource" });
  if (req.user.role === "external_supervisor" && externalOwnerColumn.has(req.params.resource)) {
    const { data: owned } = await supabase.from(req.params.resource).select("id").eq("id", req.params.id).eq("external_supervisor_id", req.user.id).maybeSingle();
    if (!owned) return res.status(403).json({ success: false, message: "You can only update your assigned training records" });
  }
  if (req.user.role === "supervisor" && supervisorOwnerColumn.has(req.params.resource)) {
    const { data: owned } = await supabase.from(req.params.resource).select("id").eq("id", req.params.id).eq("evaluator_id", req.user.id).maybeSingle();
    if (!owned) return res.status(403).json({ success: false, message: "You can only update your own evaluation records" });
  }
  if (req.user.role === "student" && studentOwnedResources.has(req.params.resource)) {
    // Students may only edit their own submissions, and only the fields they
    // own (e.g. replacing an uploaded file). Certification status changes are
    // reserved for external supervisors and admins.
    const { data: owned, error: ownedError } = await supabase
      .from(req.params.resource)
      .select("id, student_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (ownedError) return res.status(400).json({ success: false, message: ownedError.message });
    if (!owned) return res.status(404).json({ success: false, message: "Training record not found" });
    if (owned.student_id !== req.user.id) return res.status(403).json({ success: false, message: "You can only update your own submissions" });
    const editable = studentEditableFields[req.params.resource];
    if (!editable) return res.status(403).json({ success: false, message: "Students cannot update this record" });
    const sanitized = {};
    editable.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) sanitized[field] = req.body[field];
    });
    if (sanitized.status && !["draft", "submitted"].includes(sanitized.status)) {
      return res.status(403).json({ success: false, message: "Students can only set submissions to draft or submitted" });
    }
    sanitized.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from(req.params.resource).update(sanitized).eq("id", req.params.id).select().single();
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.json({ success: true, data });
  }
  const { data, error } = await supabase.from(req.params.resource).update(req.body).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  if (req.params.resource === "placement_confirmations" && req.body.status === "approved" && data?.student_id) {
    await supabase.from("users").update({
      internship_status: "active",
      internship_company: data.organization ?? null,
      internship_role: data.role ?? null,
    }).eq("id", data.student_id);
  }
  res.json({ success: true, data });
});

export default router;
