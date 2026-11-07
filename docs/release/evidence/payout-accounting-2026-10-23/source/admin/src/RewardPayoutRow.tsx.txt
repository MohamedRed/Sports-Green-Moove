import { useMemo, useRef, useState } from "react";
import { Badge } from "./AdminTable";
import { formatEuro } from "./format";
import { RewardPayoutRequestJournal, type RewardPayoutRequest } from "./rewardPayoutRequest";
import type { PayoutCandidate } from "./types";
import "./payouts.css";

export function RewardPayoutRow({ candidate, scope, send }: {
  candidate: PayoutCandidate; scope: string; send: (request: RewardPayoutRequest) => Promise<void>;
}) {
  const journal = useMemo(() => new RewardPayoutRequestJournal({
    getItem: (key) => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: (key) => sessionStorage.removeItem(key),
  }, scope, candidate.userId), [scope, candidate.userId]);
  const [initial] = useState(() => {
    try { return { request: journal.read(), error: "" }; }
    catch { return { request: null, error: "Le versement enregistré est inaccessible. Vérifiez son état avant de continuer." }; }
  });
  const [request, setRequest] = useState(initial.request);
  const [status, setStatus] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function pay() {
    if (submitting.current || initial.error) return;
    submitting.current = true; setBusy(true); setStatus("Envoi…");
    try {
      const frozen = journal.prepare(candidate.balanceCents);
      setRequest(frozen);
      await send(frozen);
      journal.complete(frozen);
      setRequest(null); setStatus("Versement confirmé");
    } catch {
      setStatus("Versement non confirmé. Vérifiez la même demande avant de continuer.");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <tr><td>{candidate.userId}</td><td>{formatEuro(candidate.balanceCents)}</td>
    <td><Badge tone={candidate.stripeReady ? "ok" : "warning"}>{candidate.stripeReady ? "Prêt" : "À configurer"}</Badge></td>
    <td className="payout-action"><button className="small-button" disabled={busy || Boolean(initial.error) || (!request && (!candidate.stripeReady || candidate.balanceCents <= 0))}
      onClick={pay}>{request ? `Vérifier le versement de ${formatEuro(request.amountCents)}` : "Verser"}</button><span role="status">{status}</span></td></tr>;
}
