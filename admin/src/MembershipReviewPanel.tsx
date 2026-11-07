import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MembershipConfirmation } from "./MembershipConfirmation";
import { MembershipReviewController } from "./MembershipReviewController";
import { membershipReviewGateway } from "./membershipReviewGateway";
import type { MembershipDecision, ReviewMembership } from "./membershipReviewTypes";

const statuses: Record<string, string> = { requested: "En attente", active: "Membre", rejected: "Refusée", cancelled: "Annulée", inactive: "Inactive" };
const roles: Record<string, string> = { clubManager: "Responsable du club", member: "Adhérent", parent: "Parent", driver: "Conducteur", child: "Enfant" };
export function MembershipReviewPanel({ uid }: { uid: string }) {
  const controller = useMemo(() => new MembershipReviewController(membershipReviewGateway(uid)), [uid]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [confirmation, setConfirmation] = useState<{ item: ReviewMembership; decision: MembershipDecision } | null>(null);
  useEffect(() => { controller.start(); return () => controller.close(); }, [controller]);
  const clubName = state.clubs.find((club) => club.id === state.clubId)?.name ?? "";
  return <section id="memberships" className="membership-panel" aria-labelledby="membership-title">
    <h2 id="membership-title">Adhésions</h2>
    <div className="membership-toolbar">
      <label>Club<select aria-label="Club à gérer" value={state.clubId} disabled={state.busy} onChange={(event) => { setConfirmation(null); void controller.select(event.target.value); }}>
        <option value="" disabled>Choisir un club</option>
        {state.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select></label>
      <button className="secondary-button" disabled={state.busy} onClick={() => { void (state.clubId ? controller.reload() : controller.loadClubs()); }}>Actualiser</button>
      {state.nextClubs && <button className="secondary-button" disabled={state.busy} onClick={() => { void controller.loadClubs(true); }}>Autres clubs</button>}
    </div>
    {state.error && <p role="alert">{state.error}</p>}
    {state.notice && <p role="status">{state.notice}</p>}
    {state.busy && <p role="status">Chargement...</p>}
    {state.clubsLoaded && !state.busy && !state.error && !state.nextClubs && state.clubs.length === 0 && <p>Aucun club à gérer.</p>}
    {state.loaded && !state.busy && !state.error && state.items.length === 0 && <p>Aucune adhésion.</p>}
    <div className="membership-list">
      {state.items.map((item) => <article className="membership-row" key={item.id} data-membership-id={item.id}>
        <div><h3>{item.name ?? "Nom indisponible"}</h3><p>{roles[item.role] ?? item.role}</p>{item.teamName && <p>{item.teamName}</p>}</div>
        <p className="membership-status">{statuses[item.status] ?? item.status}</p>
        <div className="membership-actions">{item.allowedActions.map((decision) => <button className="secondary-button" key={decision}
          disabled={state.busy || state.requiresReload} onClick={() => setConfirmation({ item, decision })}>
          {decision === "approve" ? "Accepter" : "Refuser"}
        </button>)}</div>
      </article>)}
    </div>
    {state.nextItems && <button className="secondary-button" disabled={state.busy || state.requiresReload} onClick={() => { void controller.reload(true); }}>Adhésions suivantes</button>}
    {confirmation && <MembershipConfirmation {...confirmation} clubName={clubName} onClose={() => setConfirmation(null)} onConfirm={() => {
      setConfirmation(null); void controller.decide(confirmation.item, confirmation.decision);
    }} />}
  </section>;
}
