import { useEffect, useRef, useState } from "react";
import { reviewReport, type ReportStatus } from "./actions";
import { Badge, TableSection } from "./AdminTable";
import { formatDate, statusTone, textValue } from "./format";
import type { FirestoreRecord } from "./types";
import { ReportReplyForm } from "./ReportReplyForm";
import { SupportEmailStatus } from "./SupportEmailStatus";
import "./support.css";

const REVIEW_STATUSES: ReportStatus[] = ["reviewing", "closed"];

export function ReportsTable({ reports, id = "reports", title = "Reports" }: { reports: FirestoreRecord[]; id?: string; title?: string }) {
  return (
    <TableSection id={id} title={title} className="support-reports">
      <thead><tr><th>Report</th><th>Reporter</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead>
      <tbody>{reports.map((report) => <ReportRow key={report.id} report={report} />)}</tbody>
    </TableSection>
  );
}

function ReportRow({ report }: { report: FirestoreRecord }) {
  const row = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (window.location.hash === `#support-report-${report.id}`) row.current?.scrollIntoView({ block: "start" });
  }, [report.id]);
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
    <tr ref={row} id={`support-report-${report.id}`} data-support-report={report.id}>
      <td data-label="Demande">
        {report.id}
        <span>{textValue(report.subjectType)}</span>
      </td>
      <td data-label="Demandeur">{textValue(report.reporterUserId)}</td>
      <td data-label="Motif">
        {textValue(report.reason)}
        {report.emergency === true && <strong>Urgent</strong>}
        <span>{textValue(report.description, "")}</span>
        <span>Dernière revue: {formatDate(report.reviewedAt)}</span>
        <span>{textValue(report.reviewNote, "")}</span>
      </td>
      <td data-label="Statut"><Badge tone={statusTone(report.status)}>{textValue(report.status)}</Badge></td>
      <td data-label="Traitement">
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
        {report.emergency === true && <SupportEmailStatus reportId={report.id} />}
        {typeof report.reporterUserId === "string" && ["booking", "rideSession", "message", "user", "other"].includes(String(report.subjectType)) &&
          <ReportReplyForm report={report} disabled={saving} onBusy={setReplyBusy} />}
      </td>
    </tr>
  );
}
