import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GuardianReviewController } from "./GuardianReviewController";
import { guardianReviewGateway } from "./guardianReviewGateway";
import { guardianStatusLabels, type GuardianDecision, type GuardianReview } from "./guardianReviewTypes";

const decisions: Record<GuardianDecision, string> = { verify: "Vérifier", refuse: "Refuser", revoke: "Retirer la vérification" };
export function GuardianReviewPanel({ uid }: { uid: string }) {
  const controller = useMemo(() => new GuardianReviewController(guardianReviewGateway(uid)), [uid]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [confirmation, setConfirmation] = useState<{ item: GuardianReview; action: GuardianDecision } | null>(null);
  useEffect(() => { controller.start(); return () => controller.close(); }, [controller]);
  const clubName = state.clubs.find((club) => club.id === state.clubId)?.name ?? "";
  return <section id="guardian-review" className="membership-panel" aria-labelledby="guardian-review-title">
    <h2 id="guardian-review-title">Vérification des parents</h2>
    <div className="membership-toolbar">
      <label>Club<select aria-label="Club pour vérifier les parents" value={state.clubId} disabled={state.busy}
        onChange={(event) => { setConfirmation(null); void controller.select(event.target.value); }}>
        <option value="" disabled>Choisir un club</option>
        {state.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select></label>
      <button className="secondary-button" disabled={state.busy} onClick={() => {
        setConfirmation(null); void (state.clubId ? controller.reload() : controller.loadClubs());
      }}>Actualiser</button>
      {state.nextClubs && <button className="secondary-button" disabled={state.busy} onClick={() => { void controller.loadClubs(true); }}>Autres clubs</button>}
    </div>
    {state.error && <p role="alert">{state.error}</p>}
    {state.notice && <p role="status">{state.notice}</p>}
    {state.busy && <p role="status">Chargement...</p>}
    {state.clubsLoaded && !state.busy && !state.error && !state.nextClubs && state.clubs.length === 0 && <p>Aucun club à gérer.</p>}
    {state.loaded && !state.busy && !state.error && state.items.length === 0 && <p>Aucune demande de vérification.</p>}
    <div className="membership-list">
      {state.items.map((item) => <article className="membership-row" key={item.id} data-guardian-id={item.id}>
        <div><h3>{item.parentName ?? "Nom du parent indisponible"}</h3><p>Enfant : {item.childName ?? "nom indisponible"}</p></div>
        <p className="membership-status">{guardianStatusLabels[item.status]}</p>
        <div className="membership-actions">{item.allowedActions.map((action) => <button className="secondary-button" key={action}
          disabled={state.busy || state.requiresReload || action === "verify" && (!item.parentName || !item.childName)}
          onClick={() => setConfirmation({ item, action })}>{decisions[action]}</button>)}</div>
      </article>)}
    </div>
    {state.nextItems && <button className="secondary-button" disabled={state.busy || state.requiresReload}
      onClick={() => { void controller.reload(true); }}>Demandes suivantes</button>}
    {confirmation && <GuardianConfirmation {...confirmation} clubName={clubName} onClose={() => setConfirmation(null)} onConfirm={() => {
      setConfirmation(null); void controller.decide(confirmation.item, confirmation.action);
    }} />}
  </section>;
}

function GuardianConfirmation({ item, action, clubName, onClose, onConfirm }: {
  item: GuardianReview; action: GuardianDecision; clubName: string; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal(); return () => { element?.close(); };
  }, []);
  const title = action === "verify" ? "Confirmer le lien parent-enfant ?" : action === "refuse"
    ? "Refuser cette demande ?" : "Retirer cette vérification ?";
  return <dialog className="membership-confirmation guardian-confirmation" ref={dialog} aria-labelledby="guardian-confirm-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="guardian-confirm-title">{title}</h2>
    <p>{item.parentName ?? "Nom du parent indisponible"}</p>
    <p>Enfant : {item.childName ?? "nom indisponible"}</p><p>{clubName}</p>
    <div className="membership-actions">
      <button className="secondary-button" autoFocus onClick={onClose}>Revenir</button>
      <button className="primary-button" onClick={onConfirm}>Confirmer</button>
    </div>
  </dialog>;
}
