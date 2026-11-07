import { ReportsTable } from "./ReportsTable";
import { useUrgentSupport } from "./useUrgentSupport";

export function UrgentSupportPanel() {
  const state = useUrgentSupport();
  if (state.loading) return <p role="status">Chargement du support urgent...</p>;
  if (state.error) return <p className="error-text" role="alert">{state.error}</p>;
  return <>
    <p role="status" aria-live="assertive" className={state.items.length ? "notice" : "muted"}>
      {state.items.length ? `${state.items.length} demande${state.items.length > 1 ? "s" : ""} urgente${state.items.length > 1 ? "s" : ""} à traiter` : "Aucune demande urgente."}
    </p>
    {state.items.length > 0 && <ReportsTable reports={state.items} id="urgent-support" title="Demandes urgentes" />}
  </>;
}
