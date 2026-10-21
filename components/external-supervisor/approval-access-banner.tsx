"use client";

import { useAppStore } from "@/lib/store/app-store";
import { AlertTriangle } from "lucide-react";

/**
 * Shown across the external supervisor portal when the administrator has
 * turned the external supervisor's approval access off. The portal becomes
 * view-only: submissions can still be reviewed, but approvals, certifications
 * and evaluation submissions are disabled.
 */
export function ApprovalAccessBanner() {
  const { currentUser } = useAppStore();
  if (currentUser?.approvalAccess !== false) return null;
  return (
    <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 text-sm text-text-primary">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">Approval access disabled</p>
        <p className="mt-1 text-text-secondary">
          The coordinator has turned your approval access off. You can still review trainee submissions, but approving,
          certifying and submitting evaluations is currently disabled.
        </p>
      </div>
    </div>
  );
}
