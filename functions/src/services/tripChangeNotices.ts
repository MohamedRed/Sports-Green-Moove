import { type Transaction, Timestamp } from "firebase-admin/firestore";
import { tripChangeHash } from "../domain/tripChanges.js";
import { firestore } from "../lib/firebase.js";
import type { StoredTripChange } from "./tripChangeState.js";

export function writeTripChangeNotices(transaction: Transaction, proposalId: string, change: StoredTripChange,
  kind: "proposed" | "confirmed" | "declined" | "withdrawn", now: Timestamp) {
  const text = {
    proposed: ["Modification proposée", "Le conducteur propose un nouvel horaire, parcours ou prix. Votre confirmation est nécessaire."],
    confirmed: ["Modification confirmée par les parents", "Les confirmations sont enregistrées. Les conditions du trajet ne sont pas encore modifiées."],
    declined: ["Modification refusée", "Les conditions précédentes du trajet sont conservées."],
    withdrawn: ["Modification retirée", "Le conducteur a retiré sa proposition. Les conditions précédentes sont conservées."],
  }[kind];
  const recipients = kind === "proposed" ? change.parentUserIds : [...new Set([change.driverUserId, ...change.parentUserIds])];
  for (const userId of recipients) {
    const id = tripChangeHash([proposalId, kind, userId]);
    transaction.create(firestore.collection("notifications").doc(`tripChange_${id}`), {
      userId, type: "tripChange", sourceId: change.tripId, proposalId, title: text[0], body: text[1],
      read: false, createdAt: now,
    });
  }
}
