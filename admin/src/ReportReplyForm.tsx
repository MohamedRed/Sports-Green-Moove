import { useEffect, useRef, useState } from "react";
import { auth } from "./firebase";
import { formatDate } from "./format";
import type { FirestoreRecord } from "./types";
import { prepareSupportReply, replyWasRejected, sendSupportReply, type SupportReplyIntent } from "./supportReplies";

export function ReportReplyForm({ report, disabled, onBusy }: { report: FirestoreRecord; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [text, setText] = useState(""), [status, setStatus] = useState<"reviewing" | "closed">(report.status === "closed" ? "closed" : "reviewing");
  const [intent, setIntent] = useState<SupportReplyIntent | null>(null), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const ownerUid = auth?.currentUser?.uid;
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setText(""); setIntent(null); setSaving(false); setMessage(""); onBusy(false);
    return () => { generation.current++; };
  }, [ownerUid, report.id, onBusy]);
  const latest = report.lastPublicReply as { text?: unknown; sentAt?: unknown } | undefined;
  async function submit() {
    if (saving || disabled) return;
    let pending: SupportReplyIntent;
    try { pending = intent ?? prepareSupportReply(report, text, status); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Réponse invalide."); return; }
    setIntent(pending); setSaving(true); onBusy(true); setMessage("");
    const ticket = generation.current;
    const stillCurrent = () => generation.current === ticket && auth?.currentUser?.uid === pending.ownerUid;
    try {
      await sendSupportReply(pending);
      if (!stillCurrent()) return;
      setText(""); setIntent(null); setMessage("Réponse enregistrée pour le demandeur."); onBusy(false);
    } catch (error) {
      if (!stillCurrent()) return;
      if (replyWasRejected(error)) { setIntent(null); onBusy(false); setMessage("Envoi refusé. Vérifiez la demande actualisée avant de réessayer."); }
      else setMessage("Confirmation non reçue. Réessayez cet envoi pour vérifier s’il est déjà enregistré.");
    } finally { if (stillCurrent()) setSaving(false); }
  }
  return <div className="support-reply-form">
    {typeof latest?.text === "string" && <p>Dernière réponse au demandeur : {latest.text}<span>{formatDate(latest.sentAt)}</span></p>}
    <label>Réponse au demandeur
      <textarea aria-label="Réponse au demandeur" className="review-note" maxLength={2000} value={text}
        disabled={disabled || saving || intent !== null} onChange={event => setText(event.target.value)} />
    </label>
    <label>Statut après réponse
      <select aria-label="Statut après réponse" value={status} disabled={disabled || saving || intent !== null}
        onChange={event => setStatus(event.target.value as "reviewing" | "closed")}>
        <option value="reviewing">En cours</option><option value="closed">Clôturée</option>
      </select>
    </label>
    <button className="small-button" disabled={disabled || saving || (!intent && !text.trim())} onClick={() => void submit()}>
      {saving ? "Envoi..." : intent ? "Réessayer cet envoi" : "Envoyer la réponse"}
    </button>
    {message && <span role="status">{message}</span>}
  </div>;
}
