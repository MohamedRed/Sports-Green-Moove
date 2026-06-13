import { useState } from "react";
import { reviewReport, type ReportStatus } from "./actions";
import { Badge, TableSection } from "./AdminTable";
import { formatDate, statusTone, textValue } from "./format";
import type { FirestoreRecord } from "./types";

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
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function update(status: ReportStatus) {
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
    <tr>
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
          className="review-note"
          placeholder="Note de revue"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        {REVIEW_STATUSES.map((status) => (
          <button className="small-button" disabled={saving} key={status} onClick={() => update(status)}>
            {status === "closed" ? "Close" : "Review"}
          </button>
        ))}
        <span>{message}</span>
      </td>
    </tr>
  );
}
