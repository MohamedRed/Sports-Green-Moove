import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "./firebase";
import { ReportsTable } from "./ReportsTable";
import type { FirestoreRecord } from "./types";

export function SupportReportLink({ listedIds }: { listedIds: string[] }) {
  const [reference, setReference] = useState(() => window.location.hash);
  const [state, setState] = useState<{ report: FirestoreRecord | null; loading: boolean; error: string }>({
    report: null, loading: false, error: "",
  });
  useEffect(() => {
    const changed = () => setReference(window.location.hash);
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const id = /^#support-report-([A-Za-z0-9_-]{1,128})$/.exec(reference)?.[1];
    if (!id) { setState({ report: null, loading: false, error: "" }); return; }
    setState({ report: null, loading: true, error: "" });
    if (!firestore) { setState({ report: null, loading: false, error: "Demande indisponible." }); return; }
    return onSnapshot(doc(firestore, "reports", id), snapshot => setState({
      report: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
      loading: false, error: snapshot.exists() ? "" : "Demande introuvable.",
    }), () => setState({ report: null, loading: false, error: "Impossible de charger la demande." }));
  }, [reference]);
  if (state.loading) return <p role="status">Chargement de la demande...</p>;
  if (state.error) return <p role="alert">{state.error}</p>;
  if (!state.report || listedIds.includes(state.report.id) ||
      (state.report.emergency === true && ["open", "reviewing"].includes(String(state.report.status)))) return null;
  return <ReportsTable reports={[state.report]} id="linked-support" title="Demande de support" />;
}
