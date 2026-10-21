"use client";

import { apiCreateConductRecord, apiListConductRecords, apiUploadFile, type ConductResource } from "@/lib/api";
import { useAppStore } from "@/lib/store/app-store";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button, Chip, Input, Select, SelectItem, Textarea } from "@heroui/react";
import { AlertTriangle, CalendarDays, FileText, MessageSquare, Send, Upload } from "lucide-react";
import { useEffect, useState } from "react";

type RequestStatus = "pending" | "approved" | "rejected";
type IssueStatus = "open" | "in_progress" | "resolved" | "rejected";

interface LeaveRequest { id: string; leave_type: string; date_from: string; date_to: string; reason: string; status: RequestStatus; attachment_url?: string; reviewer_response?: string; }
interface AbsenceReport { id: string; absence_dates: string; reason: string; status: RequestStatus; attachment_url?: string; reviewer_response?: string; }
interface PlacementChangeRequest { id: string; proposed_organization?: string; reason: string; supporting_notes?: string; status: RequestStatus; attachment_url?: string; reviewer_response?: string; }
interface StudentIssue { id: string; issue_type: string; severity: string; description: string; status: IssueStatus; attachment_url?: string; reviewer_response?: string; }
interface CommunicationMessage { id: string; sender_id: string; recipient_id?: string; recipient_role?: string; recipient_email?: string; subject?: string; message: string; created_at: string; }

export default function StudentConductPage() {
  const { currentUser, getStudentById } = useAppStore();
  const student = currentUser?.id ? getStudentById(currentUser.id) : undefined;
  const [tab, setTab] = useState<"leave" | "absence" | "change" | "issue" | "communication">("leave");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [absences, setAbsences] = useState<AbsenceReport[]>([]);
  const [changes, setChanges] = useState<PlacementChangeRequest[]>([]);
  const [issues, setIssues] = useState<StudentIssue[]>([]);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [leave, setLeave] = useState({ type: "Medical", from: "", to: "", reason: "" });
  const [absence, setAbsence] = useState({ dates: "", reason: "" });
  const [change, setChange] = useState({ organization: "", reason: "", notes: "" });
  const [issue, setIssue] = useState({ type: "Placement", severity: "Low", description: "" });
  const [message, setMessage] = useState({ subject: "", body: "" });

  const loadHistory = async () => {
    const [leaveResult, absenceResult, changeResult, issueResult, messageResult] = await Promise.all([
      apiListConductRecords("leave_requests"),
      apiListConductRecords("absence_reports"),
      apiListConductRecords("placement_change_requests"),
      apiListConductRecords("student_issues"),
      apiListConductRecords("communication_messages"),
    ]);
    setLeaveRequests(leaveResult.data as unknown as LeaveRequest[]);
    setAbsences(absenceResult.data as unknown as AbsenceReport[]);
    setChanges(changeResult.data as unknown as PlacementChangeRequest[]);
    setIssues(issueResult.data as unknown as StudentIssue[]);
    setMessages(messageResult.data as unknown as CommunicationMessage[]);
  };

  useEffect(() => {
    if (currentUser?.id) void loadHistory().catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load conduct history."));
  }, [currentUser?.id]);

  const uploadIfProvided = async () => {
    if (!file) return {};
    const uploaded = await apiUploadFile(file);
    return { attachment_url: uploaded.url, attachment_name: file.name };
  };
  const pickFile = (next: File | null) => { if (next && next.size > 10 * 1024 * 1024) return notifyError("Attachment must be 10MB or smaller."); setFile(next); };

  const submit = async (resource: ConductResource, payload: Record<string, unknown>, successMessage: string) => {
    try {
      await apiCreateConductRecord(resource, { ...payload, ...(await uploadIfProvided()) });
      await loadHistory();
      setFile(null);
      notifySuccess(successMessage);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to submit the request.");
    }
  };

  const submitLeave = async () => { if (!leave.from || !leave.to || !leave.reason.trim()) return notifyError("Complete the leave dates and reason."); await submit("leave_requests", { leave_type: leave.type, date_from: leave.from, date_to: leave.to, reason: leave.reason.trim() }, "Leave request submitted."); setLeave({ type: "Medical", from: "", to: "", reason: "" }); };
  const submitAbsence = async () => { if (!absence.dates || !absence.reason.trim()) return notifyError("Complete the absence dates and reason."); await submit("absence_reports", { absence_dates: absence.dates, reason: absence.reason.trim() }, "Absence report submitted."); setAbsence({ dates: "", reason: "" }); };
  const submitChange = async () => { if (!change.reason.trim()) return notifyError("Provide a reason for the placement change."); await submit("placement_change_requests", { proposed_organization: change.organization.trim() || null, reason: change.reason.trim(), supporting_notes: change.notes.trim() || null }, "Placement change request submitted."); setChange({ organization: "", reason: "", notes: "" }); };
  const submitIssue = async () => { if (!issue.description.trim()) return notifyError("Describe the issue."); await submit("student_issues", { issue_type: issue.type, severity: issue.severity, description: issue.description.trim() }, "Issue reported confidentially."); setIssue({ type: "Placement", severity: "Low", description: "" }); };
  const submitMessage = async () => {
    if (!message.body.trim()) return notifyError("Write a message first.");
    try {
      await apiCreateConductRecord("communication_messages", {
        subject: message.subject.trim() || null,
        message: message.body.trim(),
        recipients: ["coordinator", "supervisor", "external_supervisor"],
      });
      await loadHistory();
      setMessage({ subject: "", body: "" });
      notifySuccess("Message sent to the coordinator, your supervisor and your external supervisor.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to send the message.");
    }
  };

  const attachment = <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm font-medium"><Upload size={15} className="mr-2" /> {file ? file.name : "Add attachment"}<input className="hidden" type="file" onChange={(event) => { pickFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} /></label>;
  const requestChip = (status: RequestStatus | IssueStatus) => <Chip size="sm" variant="flat" color={status === "approved" || status === "resolved" ? "success" : status === "rejected" ? "danger" : status === "in_progress" ? "secondary" : "warning"}>{status.replace("_", " ")}</Chip>;

  return <div className="mx-auto max-w-5xl space-y-6"><div className="rounded-card border border-border/60 bg-white p-5 shadow-card"><div className="flex items-center gap-3"><div className="rounded-button bg-primary/10 p-2.5 text-primary"><AlertTriangle size={24} /></div><div><h1 className="ds-page-title">Conduct & Support</h1><p className="ds-page-description">Manage leave, absences, placement changes, concerns, and communication.</p></div></div></div><div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-surface-muted p-1">{[["leave", "Leave"], ["absence", "Absence"], ["change", "Placement Change"], ["issue", "Report an Issue"], ["communication", "Communication Log"]].map(([key, label]) => <Button key={key} variant={tab === key ? "solid" : "light"} color={tab === key ? "primary" : "default"} radius="lg" onPress={() => setTab(key as typeof tab)}>{label}</Button>)}</div>
    {tab === "leave" && <Section title="Leave request"><div className="grid gap-4 sm:grid-cols-2"><Select label="Type" selectedKeys={[leave.type]} onSelectionChange={(keys) => setLeave({ ...leave, type: String(Array.from(keys)[0]) })} variant="bordered">{["Medical", "Personal", "Emergency"].map((v) => <SelectItem key={v}>{v}</SelectItem>)}</Select><Input label="From date" type="date" value={leave.from} onValueChange={(from) => setLeave({ ...leave, from })} variant="bordered" /><Input label="To date" type="date" value={leave.to} onValueChange={(to) => setLeave({ ...leave, to })} variant="bordered" /></div><Textarea label="Reason" value={leave.reason} onValueChange={(reason) => setLeave({ ...leave, reason })} variant="bordered" minRows={3}/><div className="flex flex-wrap gap-3">{attachment}<Button color="primary" onPress={submitLeave}>Submit leave request</Button></div><History items={leaveRequests.map((r) => ({ title: `${r.leave_type}: ${r.date_from} – ${r.date_to}`, detail: r.reason, status: r.status, attachmentUrl: r.attachment_url, response: r.reviewer_response }))} chip={requestChip}/></Section>}
    {tab === "absence" && <Section title="Absence report"><Input label="Date(s) of absence" placeholder="e.g., 2026-08-12 or 2026-08-12 to 2026-08-13" value={absence.dates} onValueChange={(dates) => setAbsence({ ...absence, dates })} variant="bordered"/><Textarea label="Reason" value={absence.reason} onValueChange={(reason) => setAbsence({ ...absence, reason })} variant="bordered" minRows={3}/><div className="flex flex-wrap gap-3">{attachment}<Button color="primary" onPress={submitAbsence}>Submit absence report</Button></div><History items={absences.map((r) => ({ title: r.absence_dates, detail: r.reason, status: r.status, attachmentUrl: r.attachment_url, response: r.reviewer_response }))} chip={requestChip}/></Section>}
    {tab === "change" && <Section title="Placement change request"><Input label="Proposed new organization (optional)" value={change.organization} onValueChange={(organization) => setChange({ ...change, organization })} variant="bordered"/><Textarea label="Reason for change" value={change.reason} onValueChange={(reason) => setChange({ ...change, reason })} variant="bordered" minRows={3}/><Textarea label="Supporting notes" value={change.notes} onValueChange={(notes) => setChange({ ...change, notes })} variant="bordered" minRows={2}/><div className="flex flex-wrap gap-3">{attachment}<Button color="primary" onPress={submitChange}>Submit placement change request</Button></div><History items={changes.map((r) => ({ title: r.proposed_organization || "Organization not specified", detail: r.reason, status: r.status, attachmentUrl: r.attachment_url, response: r.reviewer_response }))} chip={requestChip}/></Section>}
    {tab === "issue" && <Section title="Report an issue or complaint"><div className="grid gap-4 sm:grid-cols-2"><Select label="Type" selectedKeys={[issue.type]} onSelectionChange={(keys) => setIssue({ ...issue, type: String(Array.from(keys)[0]) })} variant="bordered">{["Placement", "Supervisor", "Organization", "Safety", "Harassment", "Other"].map((v) => <SelectItem key={v}>{v}</SelectItem>)}</Select><Select label="Severity" selectedKeys={[issue.severity]} onSelectionChange={(keys) => setIssue({ ...issue, severity: String(Array.from(keys)[0]) })} variant="bordered">{["Low", "Medium", "High"].map((v) => <SelectItem key={v}>{v}</SelectItem>)}</Select></div><Textarea label="Description" value={issue.description} onValueChange={(description) => setIssue({ ...issue, description })} variant="bordered" minRows={5}/><div className="flex flex-wrap gap-3">{attachment}<Button color="danger" onPress={submitIssue}>Submit issue</Button></div><History items={issues.map((r) => ({ title: `${r.issue_type} · ${r.severity}`, detail: r.description, status: r.status, attachmentUrl: r.attachment_url, response: r.reviewer_response }))} chip={requestChip}/></Section>}
    {tab === "communication" && <Section title="Communication Log"><p className="text-sm text-text-secondary">Messages are delivered to the INDT coordinator, your internal supervisor and your external supervisor.</p><Input label="Subject (optional)" value={message.subject} onValueChange={(subject) => setMessage({ ...message, subject })} variant="bordered"/><Textarea label="Message" value={message.body} onValueChange={(body) => setMessage({ ...message, body })} variant="bordered" minRows={3}/><Button color="primary" startContent={<Send size={15}/>} onPress={submitMessage}>Send message</Button><div className="space-y-2 pt-3"><h3 className="text-sm font-semibold">Message history</h3>{messages.length === 0 ? <p className="text-sm text-text-secondary">No messages yet.</p> : messages.map((item) => <div key={item.id} className="rounded-lg bg-surface-muted p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium">{item.subject || "Message"}</p><span className="text-xs text-text-secondary">{new Date(item.created_at).toLocaleString()}</span></div><p className="mt-1 text-xs font-medium text-primary">{recipientLabel(item)}</p><p className="mt-1 text-sm text-text-secondary">{item.message}</p></div>)}</div></Section>}
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-4 rounded-card border border-border/60 bg-white p-5 shadow-card"><h2 className="text-lg font-semibold">{title}</h2>{children}</section>; }
function recipientLabel(item: CommunicationMessage) {
  const role = String(item.recipient_role ?? "");
  if (!role) return "To: supervisor";
  const pretty = role === "external_supervisor" ? "external supervisor" : role;
  return `To: ${pretty}${item.recipient_email && !item.recipient_id ? ` (${item.recipient_email})` : ""}`;
}
function History({ items, chip }: { items: Array<{ title: string; detail: string; status: RequestStatus | IssueStatus; attachmentUrl?: string; response?: string }>; chip: (status: RequestStatus | IssueStatus) => React.ReactNode }) { return <div className="space-y-2 pt-3"><h3 className="text-sm font-semibold">History</h3>{items.length === 0 ? <p className="text-sm text-text-secondary">No submissions yet.</p> : items.map((item, index) => <div key={index} className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-3"><div><p className="font-medium">{item.title}</p><p className="text-sm text-text-secondary">{item.detail}</p>{item.response && <p className="mt-1 text-sm text-text-primary">Response: {item.response}</p>}{item.attachmentUrl && <a className="mt-1 inline-block text-xs text-primary underline" href={item.attachmentUrl} target="_blank" rel="noreferrer">View attachment</a>}</div>{chip(item.status)}</div>)}</div>; }
