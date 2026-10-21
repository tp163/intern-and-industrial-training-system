"use client";

import { useAppStore } from "@/lib/store/app-store";
import { notifyError, notifySuccess } from "@/lib/notify";
import { PageHeader, ContentCard } from "@/components/ui/page-header";
import { SearchBar } from "@/components/ui/search-bar";
import { Button, Select, SelectItem, Card, CardBody, Chip, Textarea } from "@heroui/react";
import { Calendar, Clock, BookOpen, User, CheckCircle2, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";

export default function SupervisorDailyLogsPage() {
  const { reviews, updateDailyLogStatus, currentUser, supervisors, students, loadRealData } = useAppStore();

  const supervisorRecord = useMemo(
    () =>
      supervisors.find((s) => s.id === currentUser?.id) ??
      supervisors.find((s) => s.email === currentUser?.email),
    [currentUser?.email, currentUser?.id, supervisors]
  );
  const supervisorId = supervisorRecord?.id ?? currentUser?.id ?? "";

  const [studentIdFilter, setStudentIdFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRealData();
  }, [loadRealData, supervisorId]);

  // Filter students assigned to this supervisor
  const myStudents = useMemo(() => {
    return students.filter((s) => !supervisorId || s.supervisorId === supervisorId);
  }, [students, supervisorId]);

  const studentOptions = useMemo(() => {
    return [
      { key: "all", label: "All Students" },
      ...myStudents.map((s) => ({ key: s.id, label: s.name })),
    ];
  }, [myStudents]);

  // Filter logs that belong to supervisor's students and are of type "daily_log"
  const dailyLogs = useMemo(() => {
    const studentIds = new Set(myStudents.map((s) => s.id));
    return reviews
      .filter((r) => r.type === "daily_log" && studentIds.has(r.studentId))
      .sort((a, b) => b.title.localeCompare(a.title)); // Sort by date descending
  }, [reviews, myStudents]);

  const filteredLogs = useMemo(() => {
    return dailyLogs.filter((log) => {
      const matchesStudent = studentIdFilter === "all" || log.studentId === studentIdFilter;
      const matchesSearch =
        !search ||
        log.studentName.toLowerCase().includes(search.toLowerCase()) ||
        log.content.toLowerCase().includes(search.toLowerCase()) ||
        log.title.includes(search);
      return matchesStudent && matchesSearch;
    });
  }, [dailyLogs, studentIdFilter, search]);

  /**
   * Daily logs are view-only for supervisors — instead of review actions, a
   * small comment can be left on an entry. Saving the comment acknowledges the
   * entry as seen ("Viewed by Supervisor" for the student).
   */
  const handleSaveComment = async (logId: string) => {
    const comment = (comments[logId] ?? "").trim();
    setSavingIds((prev) => ({ ...prev, [logId]: true }));
    try {
      await updateDailyLogStatus(logId, "approved", comment || undefined);
      notifySuccess(comment ? "Comment saved." : "Entry acknowledged as viewed.");
      await loadRealData();
    } catch (err: any) {
      notifyError(err.message || "Failed to save the comment.");
    } finally {
      setSavingIds((prev) => ({ ...prev, [logId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Logs"
        description="View the daily diary logs submitted by your assigned student interns and leave comments."
      />

      {/* Filters section */}
      <div className="grid grid-cols-1 gap-4 rounded-card border border-border/60 bg-white p-4 shadow-card sm:grid-cols-2">
        <Select
          label="Filter by Student"
          selectedKeys={[studentIdFilter]}
          onSelectionChange={(keys) => setStudentIdFilter((Array.from(keys)[0] as string) ?? "all")}
          variant="bordered"
          radius="lg"
          aria-label="Student filter"
        >
          {studentOptions.map((opt) => (
            <SelectItem key={opt.key}>{opt.label}</SelectItem>
          ))}
        </Select>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search logs content or date..."
          className="w-full"
        />
      </div>

      <p className="text-sm text-text-secondary">
        Daily logs are <span className="font-medium text-text-primary">view only</span> — you cannot approve or reject
        entries. Use the comment box to share feedback with the student.
      </p>

      {/* Logs List */}
      <div className="space-y-4">
        {filteredLogs.length === 0 ? (
          <ContentCard>
            <div className="py-12 text-center">
              <BookOpen size={48} className="mx-auto text-text-secondary/40 mb-3" />
              <p className="font-medium text-text-primary">No daily logs match the filters</p>
              <p className="mt-1 text-sm text-text-secondary">
                Adjust your filters or search query to find entries.
              </p>
            </div>
          </ContentCard>
        ) : (
          filteredLogs.map((log) => {
            const isViewed = log.status === "approved";
            return (
              <Card key={log.id} className="border border-border/60 bg-white shadow-sm hover:shadow-card transition-all" radius="lg">
                <CardBody className="p-5 space-y-4">
                  {/* Top info row */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text-primary text-base flex items-center gap-1">
                          <User size={16} className="text-primary" />
                          {log.studentName}
                        </span>
                        <Chip size="sm" variant="flat" color="primary" startContent={<Calendar size={12} />}>
                          {log.title}
                        </Chip>
                        {log.score ? (
                          <Chip size="sm" variant="flat" color="secondary" startContent={<Clock size={12} />}>
                            {log.score} hrs worked
                          </Chip>
                        ) : null}
                        {isViewed && (
                          <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 size={12} />}>
                            Viewed
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Submitted {formatDate(log.submittedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Diary content (read-only) */}
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed bg-surface-muted p-4 rounded-button border border-border/40">
                    {log.content}
                  </p>

                  {log.attachmentUrl ? (
                    <a
                      href={log.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline"
                    >
                      <BookOpen size={14} /> Additional information: {log.attachmentName ?? "attachment"}
                    </a>
                  ) : null}

                  {/* Small comment block */}
                  <div className="border-t border-border/40 pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Textarea
                        aria-label={`Comment on ${log.studentName}'s entry`}
                        placeholder="Add a small comment for the student…"
                        value={comments[log.id] ?? log.feedback ?? ""}
                        onValueChange={(val) => setComments((prev) => ({ ...prev, [log.id]: val }))}
                        variant="bordered"
                        radius="lg"
                        minRows={1}
                        maxRows={4}
                        className="flex-1"
                      />
                      <Button
                        color="primary"
                        variant="flat"
                        radius="lg"
                        size="sm"
                        className="shrink-0"
                        startContent={<MessageSquare size={14} />}
                        isLoading={savingIds[log.id]}
                        onPress={() => void handleSaveComment(log.id)}
                      >
                        {log.feedback ? "Update comment" : "Save comment"}
                      </Button>
                    </div>
                    {log.feedback && (
                      <p className="mt-2 text-sm text-text-secondary italic">
                        Your comment: “{log.feedback}”
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
