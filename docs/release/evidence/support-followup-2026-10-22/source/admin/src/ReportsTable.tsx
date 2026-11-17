import { useState } from "react";
import { reviewReport, type ReportStatus } from "./actions";
import { Badge, TableSection } from "./AdminTable";
import { formatDate, statusTone, textValue } from "./format";
import type { FirestoreRecord } from "./types";
import { ReportReplyForm } from "./ReportReplyForm";

const REVIEW_STATUSES: ReportStatus[] = ["reviewing", "closed"];

export function ReportsTable({ reports }: { reports: FirestoreRecord[] }) {
  return (
    <TableSection id="reports" title="Reports">
      <thead><tr><th>Report</th><th>Reporter</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead>
      <tbody>{reports.map((report) => <ReportRow key={report.id} report={report} />)}</tbody>
    </TableSection>
  );
}

function ReportRow({ report }: { report: FirestoreRecord }) {
  const [saving, setSaving] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function update(status: ReportStatus) {
    if (saving || replyBusy) return;
    setSaving(true);
    setMessage("Enregistrement...");
    try {
      await reviewReport(report.id, status, note);
      setNote("");
      setMessage(status === "closed" ? "Rapport clôturé" : "Rapport en revue");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur rapport");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr data-support-report={report.id}>
      <td>
        {report.id}
        <span>{textValue(report.subjectType)}</span>
      </td>
      <td>{textValue(report.reporterUserId)}</td>
      <td>
        {textValue(report.reason)}
        <span>{textValue(report.description, "")}</span>
        <span>Dernière revue: {formatDate(report.reviewedAt)}</span>
        <span>{textValue(report.reviewNote, "")}</span>
      </td>
      <td><Badge tone={statusTone(report.status)}>{textValue(report.status)}</Badge></td>
      <td>
        <textarea
          aria-label="Note interne"
          className="review-note"
          placeholder="Note interne"
          value={note}
          disabled={saving || replyBusy}
          onChange={(event) => setNote(event.target.value)}
        />
        {REVIEW_STATUSES.map((status) => (
          <button className="small-button" disabled={saving || replyBusy} key={status} onClick={() => update(status)}>
            {status === "closed" ? "Close" : "Review"}
          </button>
        ))}
        <span>{message}</span>
        {typeof report.reporterUserId === "string" && ["booking", "rideSession", "message", "user", "other"].includes(String(report.subjectType)) &&
          <ReportReplyForm report={report} disabled={saving} onBusy={setReplyBusy} />}
      </td>
    </tr>
  );
}
