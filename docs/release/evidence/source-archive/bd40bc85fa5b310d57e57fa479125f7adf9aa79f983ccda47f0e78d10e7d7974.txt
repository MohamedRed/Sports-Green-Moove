import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TeamReviewController } from "./TeamReviewController";
import { TeamReviewConfirmation } from "./TeamReviewConfirmation";
import { teamReviewGateway } from "./teamReviewGateway";
import { teamStatusLabels, type TeamDecision, type TeamReview } from "./teamReviewTypes";
import "./teamReview.css";

const decisions: Record<TeamDecision, string> = { approve: "Approuver", refuse: "Refuser", revoke: "Retirer l'inscription" };
export function TeamReviewPanel({ uid }: { uid: string }) {
  const controller = useMemo(() => new TeamReviewController(teamReviewGateway(uid)), [uid]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [confirmation, setConfirmation] = useState<{ item: TeamReview; action: TeamDecision } | null>(null);
  useEffect(() => { controller.start(); return () => controller.close(); }, [controller]);
  const team = state.teams.find((row) => row.id === state.teamId);
  return <section id="team-review" className="membership-panel" aria-labelledby="team-review-title">
    <h2 id="team-review-title">Inscriptions aux équipes</h2>
    <div className="membership-toolbar">
      <label>Club<select aria-label="Club pour les inscriptions aux équipes" value={state.clubId} disabled={state.busy}
        onChange={(event) => { setConfirmation(null); void controller.selectClub(event.target.value); }}>
        <option value="" disabled>Choisir un club</option>
        {state.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select></label>
      <label>Équipe<select aria-label="Équipe pour les inscriptions" value={state.teamId} disabled={state.busy || !state.teams.length}
        onChange={(event) => { setConfirmation(null); void controller.selectTeam(event.target.value); }}>
        <option value="" disabled>Choisir une équipe</option>
        {state.teams.map((item) => <option key={item.id} value={item.id}>{item.name ?? "Nom indisponible"}{item.open ? "" : " (fermée)"}</option>)}
      </select></label>
      <button className="secondary-button" disabled={state.busy} onClick={() => { setConfirmation(null);
        void (state.teamId ? controller.reload() : state.clubId ? controller.loadTeams() : controller.loadClubs()); }}>Actualiser</button>
      {state.clubId && <button className="secondary-button" disabled={state.busy} onClick={() => {
        setConfirmation(null); void controller.loadTeams(); }}>Actualiser les équipes</button>}
      {state.nextClubs && <button className="secondary-button" disabled={state.busy} onClick={() => { setConfirmation(null); void controller.loadClubs(true); }}>Autres clubs</button>}
      {state.nextTeams && <button className="secondary-button" disabled={state.busy} onClick={() => { setConfirmation(null); void controller.loadTeams(true); }}>Autres équipes</button>}
    </div>
    {state.error && <p role="alert">{state.error}</p>}{state.notice && <p role="status">{state.notice}</p>}
    {state.busy && <p role="status">Chargement...</p>}
    {state.clubsLoaded && !state.busy && !state.error && !state.nextClubs && !state.clubs.length && <p>Aucun club à gérer.</p>}
    {state.teamsLoaded && !state.busy && !state.error && !state.nextTeams && !state.teams.length && <p>Aucune équipe.</p>}
    {state.teamId && state.teamName && <h3>{state.teamName}</h3>}
    {state.loaded && !state.busy && !state.error && !state.items.length && <p>Aucune inscription.</p>}
    <div className="membership-list">{state.items.map((item) => <article className="membership-row" key={item.id} data-team-enrollment-id={item.id}>
      <div><h3>{item.subjectName ?? "Nom indisponible"}</h3><p>{item.subjectKind === "child" ? "Enfant" : "Membre"}</p></div>
      <p className="membership-status">{teamStatusLabels[item.status]}</p>
      <div className="membership-actions">{item.allowedActions.map((action) => <button className="secondary-button" key={action}
        disabled={state.busy || state.requiresReload || item.revision >= Number.MAX_SAFE_INTEGER ||
          action === "approve" && (!team?.open || !state.teamName || !item.subjectName)}
        onClick={() => setConfirmation({ item, action })}>{decisions[action]}</button>)}</div>
    </article>)}</div>
    {state.nextItems && <button className="secondary-button" disabled={state.busy || state.requiresReload}
      onClick={() => { setConfirmation(null); void controller.reload(true); }}>Inscriptions suivantes</button>}
    {confirmation && <TeamReviewConfirmation {...confirmation} clubName={state.clubs.find((club) => club.id === state.clubId)?.name ?? ""}
      teamName={state.teamName} onClose={() => setConfirmation(null)} onConfirm={() => {
        setConfirmation(null); void controller.decide(confirmation.item, confirmation.action);
      }} />}
  </section>;
}
