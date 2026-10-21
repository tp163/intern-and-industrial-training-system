import type { FormCData, MonthlyReportData } from "@/types";

/**
 * Client-side generation of official training documents.
 *
 * Documents are produced as Word-compatible HTML (.doc) files so they can be
 * extracted (downloaded), completed/signed, and uploaded back into the system
 * without any extra dependencies. The same HTML powers the in-app preview and
 * the browser's print-to-PDF option.
 */

const documentStyles = `
  body { font-family: "Times New Roman", Times, serif; color: #111; margin: 24px; font-size: 12.5pt; }
  .doc-header { text-align: center; }
  .doc-header h2 { margin: 0; font-size: 15pt; text-transform: uppercase; }
  .doc-header p { margin: 4px 0 0; font-size: 11pt; }
  .doc-rule { border: none; border-top: 2px solid #111; margin: 12px 0 16px; }
  .doc-title { text-align: center; font-weight: bold; margin: 12px 0 4px; }
  .doc-note { font-size: 10pt; color: #333; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td { border: 1px solid #444; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #efefef; }
  .field-row { margin: 10px 0; }
  .field-label { font-weight: bold; }
  .signature-block { margin-top: 32px; width: 50%; }
  .muted { color: #555; font-size: 10pt; }
  @media print { body { margin: 0; } }
`;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function display(value: unknown): string {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : "…………………………………………";
}

function formatDateLabel(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "……/……/…………";
  return escapeHtml(text);
}

export function formCDocumentHtml(data: FormCData): string {
  const descriptionRows = (data.trainingDescription ?? [])
    .filter((row) => row.division?.trim() || row.natureOfTraining?.trim())
    .map(
      (row) => `<tr>
        <td>${display(row.division)}</td>
        <td>${display(row.durationWeeks)}</td>
        <td>${display(row.natureOfTraining)}</td>
        <td>${display(row.certifyingOfficer)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Form C – Details of Industrial Training Completed</title>
<style>${documentStyles}</style></head>
<body>
  <div class="doc-header">
    <h2>Industrial Training Program of the Undergraduates</h2>
    <p>Faculty of Applied Sciences</p>
    <p>Wayamba University of Sri Lanka</p>
  </div>
  <hr class="doc-rule" />
  <p class="doc-title">Form C – Details of Industrial Training Completed</p>
  <div class="field-row"><span class="field-label">1. Name of Trainee:</span> ${display(data.traineeName)}</div>
  <div class="field-row"><span class="field-label">2. University Registration Number:</span> ${display(data.registrationNumber)}</div>
  <div class="field-row"><span class="field-label">3. E-mail Address:</span> ${display(data.emailAddress)}</div>
  <div class="field-row">
    <span class="field-label">4. I. Contact Address / Telephone Number:</span> ${display(data.contactAddress)} / ${display(data.contactTelephone)}
  </div>
  <div class="field-row">
    <span class="field-label">&nbsp;&nbsp;&nbsp;II. Residential Address / Telephone Number:</span> ${display(data.residentialAddress)} / ${display(data.residentialTelephone)}
  </div>
  <div class="field-row">
    <span class="field-label">5. Training Stage:</span> ${data.trainingStage === "repeat" ? "Repeat" : "First time"}
  </div>
  <div class="field-row">
    <span class="field-label">6. Period of Training:</span> From: ${formatDateLabel(data.periodFrom)} &nbsp;&nbsp;To: ${formatDateLabel(data.periodTo)}
  </div>
  <div class="field-row"><span class="field-label">7. Name of Training Establishment:</span> ${display(data.trainingEstablishment)}</div>
  <div class="field-row"><span class="field-label">8. Description of Training Received:</span></div>
  <table>
    <thead>
      <tr><th style="width:28%">Division / Workshop / Site</th><th style="width:14%">Duration (in weeks)</th><th style="width:30%">Nature of Training</th><th style="width:28%">Signature of Certifying Officer</th></tr>
    </thead>
    <tbody>${descriptionRows || `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`}</tbody>
  </table>
  <div class="field-row"><span class="field-label">9. Comments of Training Officer on Trainee’s:</span></div>
  <div class="field-row"><span class="field-label">Work:</span> ${display(data.workComments)}</div>
  <div class="field-row"><span class="field-label">Conduct:</span> ${display(data.conductComments)}</div>
  <div class="field-row"><span class="field-label">Attendance:</span> ${display(data.attendanceComments)}</div>
  <div class="field-row">
    <span class="field-label">Number of Days of Leave:</span>
    Authorised: ${display(data.authorisedLeaveDays)} &nbsp;&nbsp; Unauthorised: ${display(data.unauthorisedLeaveDays)}
  </div>
  <div class="field-row"><span class="field-label">10. Signature and the Official Seal of the Officer in Charge of the Trainee:</span></div>
  <div class="signature-block">
    <p>Supervisor’s Name: ${display(data.officerInCharge)}</p>
    <p>Designation: ${display(data.officerDesignation)}</p>
    <p>Signature: ……………………………………</p>
    <p>Date: ${formatDateLabel(data.dateSigned)}</p>
    <p>Organization: <span class="muted">Official Stamp</span></p>
  </div>
</body>
</html>`;
}

export function monthlyReportDocumentHtml(data: MonthlyReportData): string {
  const entryRows = (data.entries ?? [])
    .map(
      (entry) => `<tr>
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(String(entry.hours ?? "—"))}</td>
        <td>${escapeHtml(entry.summary ?? "")}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Monthly Report – ${escapeHtml(data.month)}</title>
<style>${documentStyles}</style></head>
<body>
  <div class="doc-header">
    <h2>Industrial Training Program of the Undergraduates</h2>
    <p>Faculty of Applied Sciences</p>
    <p>Wayamba University of Sri Lanka</p>
  </div>
  <hr class="doc-rule" />
  <p class="doc-title">Monthly Report – ${escapeHtml(data.month)}</p>
  <table>
    <tbody>
      <tr><th style="width:35%">Name of Trainee</th><td>${display(data.studentName)}</td></tr>
      <tr><th>University Registration Number</th><td>${display(data.registrationNumber)}</td></tr>
      <tr><th>Degree Program</th><td>${display(data.program)}</td></tr>
      <tr><th>Academic Year</th><td>${display(data.academicYear)}</td></tr>
      <tr><th>E-mail Address</th><td>${display(data.emailAddress)}</td></tr>
      <tr><th>Telephone</th><td>${display(data.telephone)}</td></tr>
      <tr><th>Training Establishment</th><td>${display(data.trainingEstablishment)}</td></tr>
      <tr><th>Role / Position</th><td>${display(data.internshipRole)}</td></tr>
      <tr><th>Reporting Period</th><td>${formatDateLabel(data.periodFrom)} to ${formatDateLabel(data.periodTo)}</td></tr>
      <tr><th>Total Hours Recorded</th><td>${escapeHtml(String(data.totalHours ?? 0))} hours across ${escapeHtml(String(data.totalEntries ?? 0))} entries</td></tr>
    </tbody>
  </table>
  <p class="doc-title">Daily Log Summary</p>
  <table>
    <thead><tr><th style="width:18%">Date</th><th style="width:14%">Hours</th><th>Activities</th></tr></thead>
    <tbody>${entryRows || `<tr><td colspan="3">No daily log entries were recorded for this month.</td></tr>`}</tbody>
  </table>
  <div class="signature-block">
    <p>Signature of Trainee: ……………………………………</p>
    <p>Signature of Training Officer: …………………………………… &nbsp;&nbsp;Date: …………………</p>
  </div>
</body>
</html>`;
}

/** Download an HTML document as a Word-compatible .doc file. */
export function downloadHtmlAsDoc(html: string, fileName: string): void {
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".doc") ? fileName : `${fileName}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Open the browser print dialog for a document (Print → Save as PDF). */
export function printHtmlDocument(html: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  const runPrint = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      window.setTimeout(() => document.body.removeChild(frame), 1000);
    }
  };
  if (frame.contentWindow?.document.readyState === "complete") {
    runPrint();
  } else {
    frame.onload = runPrint;
    window.setTimeout(runPrint, 400);
  }
}
