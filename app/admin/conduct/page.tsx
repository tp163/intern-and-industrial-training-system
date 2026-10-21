"use client";

import { apiListConductRecords, apiUpdateConductRecord, type ConductResource } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Button, Chip, Select, SelectItem, Textarea } from "@heroui/react";
import { useEffect, useState } from "react";

const tabs: Array<{ resource: ConductResource; label: string; statuses: string[] }> = [
  { resource: "leave_requests", label: "Leave", statuses: ["pending", "approved", "rejected"] },
  { resource: "absence_reports", label: "Absence", statuses: ["pending", "approved", "rejected"] },
  { resource: "placement_change_requests", label: "Placement Change", statuses: ["pending", "approved", "rejected"] },
  { resource: "student_issues", label: "Issues", statuses: ["open", "in_progress", "resolved", "rejected"] },
  { resource: "communication_messages", label: "Communication", statuses: [] },
];

type RecordRow = Record<string, unknown> & { id: string };

export default function AdminConductPage() {
  const [active, setActive] = useState<ConductResource>("leave_requests");
  const [records, setRecords] = useState<Record<ConductResource, RecordRow[]>>({
    leave_requests: [], absence_reports: [], placement_change_requests: [], student_issues: [], communication_messages: [],
  });
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const config = tabs.find((tab) => tab.resource === active) ?? tabs[0];

  const load = async () => {
    const results = await Promise.all(tabs.map((tab) => apiListConductRecords(tab.resource)));
    setRecords(Object.fromEntries(results.map((result, index) => [tabs[index].resource, result.data as RecordRow[]])) as typeof records);
  };

  useEffect(() => {
    void load().catch((error) => notifyError(error instanceof Error ? error.message : "Failed to load conduct records."));
  }, []);

  const getDetails = (record: RecordRow) => {
    if (active === "leave_requests") return `${String(record.leave_type)}: ${String(record.date_from)} - ${String(record.date_to)}\n${String(record.reason)}`;
    if (active === "absence_reports") return `${String(record.absence_dates)}\n${String(record.reason)}`;
    if (active === "placement_change_requests") return `${String(record.proposed_organization || "Organization not specified")}\n${String(record.reason)}\n${String(record.supporting_notes || "")}`;
    if (active === "student_issues") return `${String(record.issue_type)} - ${String(record.severity)}\n${String(record.description)}`;
    const role = record.recipient_role ? String(record.recipient_role).replace("_", " ") : "supervisor";
    const email = record.recipient_email && !record.recipient_id ? ` (${String(record.recipient_email)})` : "";
    return `To: ${role}${email}\n${String(record.subject || "Message")}\n${String(record.message)}`;
  };

  const saveReview = async (record: RecordRow) => {
    const status = statuses[record.id];
    if (!status || !config.statuses.length) return;
    try {
      await apiUpdateConductRecord(active, record.id, { status, reviewer_response: responses[record.id]?.trim() || null });
      await load();
      notifySuccess("Conduct record updated.");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to update conduct record.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="ds-page-title">Conduct & Support Review</h1>
        <p className="ds-page-description">Review student leave, absence, placement change, and issue submissions.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-surface-muted p-1">
        {tabs.map((tab) => <Button key={tab.resource} variant={active === tab.resource ? "solid" : "light"} color={active === tab.resource ? "primary" : "default"} radius="lg" onPress={() => setActive(tab.resource)}>{tab.label}</Button>)}
      </div>
      <div className="space-y-3">
        {records[active].length === 0 ? <div className="rounded-card border border-border/60 bg-white p-10 text-center text-sm text-text-secondary">No records submitted yet.</div> : records[active].map((record) => {
          const currentStatus = statuses[record.id] ?? String(record.status ?? "pending");
          return <div key={record.id} className="rounded-card border border-border/60 bg-white p-5 shadow-card">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="max-w-3xl whitespace-pre-wrap text-sm text-text-primary">{getDetails(record)}</div>
              {Boolean(record.attachment_url) && <a className="text-sm text-primary underline" href={String(record.attachment_url)} target="_blank" rel="noreferrer">View attachment</a>}
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-end">
              {config.statuses.length > 0 ? <Select label="Status" selectedKeys={[currentStatus]} onSelectionChange={(keys) => setStatuses((current) => ({ ...current, [record.id]: String(Array.from(keys)[0] ?? currentStatus) }))} className="sm:w-56" variant="bordered">
                {config.statuses.map((status) => <SelectItem key={status}>{status.replace("_", " ")}</SelectItem>)}
              </Select> : <Chip variant="flat">Message</Chip>}
              {config.statuses.length > 0 && <Textarea label="Response" value={responses[record.id] ?? String(record.reviewer_response ?? "")} onValueChange={(value) => setResponses((current) => ({ ...current, [record.id]: value }))} variant="bordered" minRows={1} className="flex-1" />}
              {config.statuses.length > 0 && <Button color="primary" onPress={() => void saveReview(record)}>Save</Button>}
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}
