import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { useSupportEmail } from "./useUrgentSupport";

const labels: Record<string, string> = { queued: "E-mail en attente", sending: "Envoi de l’e-mail en cours",
  accepted: "E-mail accepté pour envoi", needs_configuration: "Envoi e-mail non configuré", needs_review: "Confirmation e-mail à vérifier",
  missing: "Envoi e-mail à vérifier", unavailable: "État de l’e-mail indisponible", loading: "Vérification de l’e-mail..." };

export function SupportEmailStatus({ reportId }: { reportId: string }) {
  const state = useSupportEmail(reportId), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function retry() {
    if (busy || !functions) return;
    setBusy(true); setError("");
    try { await httpsCallable(functions, "retryUrgentSupportEmail")({ reportId }); }
    catch { setError("L’envoi reste à vérifier."); }
    finally { setBusy(false); }
  }
  return <div className="support-email-status">
    <span role="status">{labels[state.status] ?? "État de l’e-mail à vérifier"}</span>
    {["queued", "needs_configuration"].includes(state.status) && <button className="small-button" disabled={busy}
      onClick={retry}>{busy ? "Vérification..." : "Vérifier l’envoi de l’e-mail"}</button>}
    {error && <span role="alert">{error}</span>}
  </div>;
}
