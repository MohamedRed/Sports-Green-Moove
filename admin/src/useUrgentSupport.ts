import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { firestore } from "./firebase";
import type { CollectionState, FirestoreRecord } from "./types";

export function useUrgentSupport() {
  const [state, setState] = useState<CollectionState<FirestoreRecord>>({ items: [], loading: true, error: null });
  useEffect(() => {
    if (!firestore) { setState({ items: [], loading: false, error: "Connexion au support indisponible." }); return; }
    // A dedicated query prevents an urgent request being hidden by the ordinary 50-row table.
    return onSnapshot(query(collection(firestore, "reports"), where("emergency", "==", true),
      where("status", "in", ["open", "reviewing"]), orderBy("createdAt", "asc")),
    snapshot => setState({ items: snapshot.docs.map(row => ({ id: row.id, ...row.data() })), loading: false, error: null }),
    () => setState({ items: [], loading: false, error: "Impossible de charger les demandes urgentes." }));
  }, []);
  return state;
}

export function useSupportEmail(reportId: string) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    setState({ status: "loading" });
    if (!firestore) { setState({ status: "unavailable" }); return; }
    return onSnapshot(doc(firestore, "supportUrgentEmailOutbox", reportId), snapshot =>
      setState({ status: snapshot.exists() ? String(snapshot.get("status")) : "missing" }),
    () => setState({ status: "unavailable" }));
  }, [reportId]);
  return state;
}
