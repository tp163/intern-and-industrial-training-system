import { Router } from "express";
import { supabase } from "../config/supabase.js";

const router = Router();
const resources = new Map([
  ["leave_requests", { table: "leave_requests", status: ["pending", "approved", "rejected"] }],
  ["absence_reports", { table: "absence_reports", status: ["pending", "approved", "rejected"] }],
  ["placement_change_requests", { table: "placement_change_requests", status: ["pending", "approved", "rejected"] }],
  ["student_issues", { table: "student_issues", status: ["open", "in_progress", "resolved", "rejected"] }],
  ["communication_messages", { table: "communication_messages", status: [] }],
]);

async function visibleStudentIds(req) {
  if (req.user.role === "admin") return null;
  if (req.user.role === "student") return [req.user.id];
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("role", "student")
    .eq("supervisor_id", req.user.id);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

function getResource(req, res) {
  const resource = resources.get(req.params.resource);
  if (!resource) {
    res.status(404).json({ success: false, message: "Unknown conduct resource" });
    return null;
  }
  return resource;
}

router.get("/:resource", async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;
  try {
    const studentIds = await visibleStudentIds(req);
    let query = supabase.from(resource.table).select("*").order("created_at", { ascending: false });
    if (studentIds) {
      if (studentIds.length === 0) return res.json({ success: true, data: [] });
      if (resource.table === "communication_messages") {
        query = query.or(`sender_id.in.(${studentIds.join(",")}),recipient_id.eq.${req.user.id}`);
      } else {
        query = query.in("student_id", studentIds);
      }
    }
    const { data, error } = await query;
    if (error) return res.status(400).json({ success: false, message: error.message });
    res.json({ success: true, data: data ?? [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:resource", async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;
  if (req.user.role !== "student") return res.status(403).json({ success: false, message: "Only students can submit conduct requests" });
  const payload = { ...req.body, student_id: req.user.id };
  if (resource.table === "communication_messages") {
    payload.sender_id = req.user.id;
    delete payload.student_id;
    // A communication log message is delivered to the training coordinator,
    // the internal supervisor and the external supervisor at once. Resolve the
    // recipient accounts server-side and insert one row per recipient.
    const requestedRecipients = Array.isArray(req.body.recipients)
      ? req.body.recipients.map(String)
      : ["coordinator", "supervisor", "external_supervisor"];
    const validRecipients = requestedRecipients.filter((r) =>
      ["coordinator", "supervisor", "external_supervisor"].includes(r)
    );
    const targets = [];
    const seen = new Set();

    const pushTarget = (role, userId = null, email = null) => {
      const key = `${role}:${userId ?? email ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({ role, userId, email });
    };

    try {
      if (validRecipients.includes("coordinator")) {
        const { data: admins, error: adminsError } = await supabase
          .from("users")
          .select("id, email")
          .eq("role", "admin");
        if (adminsError) return res.status(400).json({ success: false, message: adminsError.message });
        (admins ?? []).forEach((admin) => pushTarget("coordinator", admin.id, admin.email));
      }

      if (validRecipients.includes("supervisor")) {
        const { data: student, error: studentError } = await supabase
          .from("users")
          .select("supervisor_id")
          .eq("id", req.user.id)
          .single();
        if (studentError) return res.status(400).json({ success: false, message: studentError.message });
        if (student?.supervisor_id) {
          const { data: supervisor, error: supervisorError } = await supabase
            .from("users")
            .select("id, email")
            .eq("id", student.supervisor_id)
            .maybeSingle();
          if (supervisorError) return res.status(400).json({ success: false, message: supervisorError.message });
          if (supervisor) pushTarget("supervisor", supervisor.id, supervisor.email);
        }
      }

      if (validRecipients.includes("external_supervisor")) {
        const { data: appointments, error: appointmentsError } = await supabase
          .from("external_supervisor_appointments")
          .select("external_supervisor_email, external_supervisor_name")
          .eq("student_id", req.user.id)
          .order("created_at", { ascending: false });
        if (appointmentsError) return res.status(400).json({ success: false, message: appointmentsError.message });
        const emails = Array.from(
          new Set(
            (appointments ?? [])
              .map((appointment) => appointment.external_supervisor_email)
              .filter(Boolean)
              .map((email) => String(email).trim().toLowerCase())
          )
        );
        for (const email of emails) {
          const { data: externalUser, error: externalError } = await supabase
            .from("users")
            .select("id, email")
            .eq("role", "external_supervisor")
            .ilike("email", email)
            .maybeSingle();
          if (externalError) return res.status(400).json({ success: false, message: externalError.message });
          // When the external supervisor has no account yet, keep the message
          // addressed to their email so staff can still see it was sent.
          pushTarget("external_supervisor", externalUser?.id ?? null, externalUser?.email ?? email);
        }
      }

      const rows = (targets.length ? targets : [{ role: "coordinator", userId: null, email: null }]).map((target) => ({
        sender_id: req.user.id,
        recipient_id: target.userId,
        recipient_role: target.role,
        recipient_email: target.email,
        subject: req.body.subject ?? null,
        message: req.body.message,
      }));

      const { data, error } = await supabase.from("communication_messages").insert(rows).select();
      if (error) return res.status(400).json({ success: false, message: error.message });
      return res.status(201).json({ success: true, data: data ?? [], recipients: targets });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
  const { data, error } = await supabase.from(resource.table).insert([payload]).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.status(201).json({ success: true, data });
});

router.put("/:resource/:id", async (req, res) => {
  const resource = getResource(req, res);
  if (!resource) return;
  if (!['admin', 'supervisor'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Only staff can review conduct records" });
  }
  if (req.user.role === "supervisor" && resource.table !== "communication_messages") {
    const { data: record, error: recordError } = await supabase
      .from(resource.table)
      .select("student_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (recordError) return res.status(400).json({ success: false, message: recordError.message });
    if (!record) return res.status(404).json({ success: false, message: "Conduct record not found" });
    const { data: student, error: studentError } = await supabase
      .from("users")
      .select("id")
      .eq("id", record.student_id)
      .eq("supervisor_id", req.user.id)
      .maybeSingle();
    if (studentError) return res.status(400).json({ success: false, message: studentError.message });
    if (!student) return res.status(403).json({ success: false, message: "You can only review assigned students" });
  }
  const patch = { ...req.body, reviewer_id: req.user.id, reviewed_at: new Date().toISOString() };
  if (resource.status.length && (!resource.status.includes(patch.status))) {
    return res.status(400).json({ success: false, message: "Invalid conduct status" });
  }
  const { data, error } = await supabase.from(resource.table).update(patch).eq("id", req.params.id).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, data });
});

export default router;
