"use client";
import { apiListTrainingRecords } from "@/lib/api";
import { useAppStore } from "@/lib/store/app-store";
import { Button, Chip } from "@heroui/react";
import { FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const officialForms = [
  {
    key: "form-c",
    title: "Form C – Details of Industrial Training Completed",
    description:
      "Official Form C issued by the Faculty of Applied Sciences. Download the blank form, complete it, and upload the signed copy from the Daily Log Book → Form C section.",
    fileName: "Form C.pdf",
    fileUrl: "/forms/form-c.pdf",
  },
];

export default function StudentDocumentsPage() {
  const { currentUser } = useAppStore();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [formCStatus, setFormCStatus] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiListTrainingRecords("training_documents")
      .then((r) => setItems(r.data))
      .catch(() => {});
    if (currentUser?.id) {
      apiListTrainingRecords("form_c_submissions")
        .then((r) => setFormCStatus(r.data.find((item) => String(item.student_id) === currentUser.id) ?? null))
        .catch(() => {});
    }
  }, [currentUser?.id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="ds-page-title">Training Documents</h1>
        <p className="ds-page-description">
          Official forms and appointment letters issued by the university for your training.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
          <ShieldCheck size={18} className="text-primary" /> Official Forms
        </h2>
        {officialForms.map((form) => (
          <div key={form.key} className="rounded-card border border-border bg-white p-4 shadow-card">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">{form.title}</p>
                <p className="mt-1 max-w-2xl text-sm text-text-secondary">{form.description}</p>
                {form.key === "form-c" && formCStatus?.file_url ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="flat" color={String(formCStatus.status) === "submitted" ? "success" : "warning"}>
                      Your Form C: {String(formCStatus.status ?? "draft").replace("_", " ")}
                    </Chip>
                    <a className="text-xs font-medium text-primary underline" href={String(formCStatus.file_url)} target="_blank" rel="noreferrer">
                      View your uploaded Form C
                    </a>
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button as="a" href={form.fileUrl} download variant="flat" startContent={<FileText size={16} />}>
                  Download {form.fileName}
                </Button>
                <Button as="a" href={form.fileUrl} target="_blank" rel="noreferrer" variant="bordered">
                  View
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {items.length === 0 ? (
        <p className="rounded-card border border-border bg-white p-6 text-sm text-text-secondary">
          No additional documents have been issued yet.
        </p>
      ) : (
        items.map((item) => (
          <div key={String(item.id)} className="flex items-center justify-between rounded-card border border-border bg-white p-4">
            <div>
              <p className="font-semibold">{String(item.title)}</p>
              <p className="text-sm text-text-secondary">{String(item.file_name ?? "PDF document")}</p>
            </div>
            <Button as="a" href={String(item.file_url)} download variant="flat" startContent={<FileText size={16} />}>
              Download PDF
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
