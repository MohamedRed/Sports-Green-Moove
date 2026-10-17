import { HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";
import { tripChangeHash, type tripChangeRequestReferenceSchema } from "../domain/tripChanges.js";
import { firestore } from "../lib/firebase.js";
import { loadStoredTripChange, loadTripChangeState, requireTripChangeDriver, tripChangeView } from "./tripChangeState.js";

/** Resolve an uncertain proposal without resubmitting it or changing any record. */
export async function resolveTripChangeRequest(data: z.infer<typeof tripChangeRequestReferenceSchema>, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const trip = await transaction.get(firestore.collection("trips").doc(data.tripId));
    if (!trip.exists) throw new HttpsError("not-found", "Trip not found.");
    requireTripChangeDriver(trip.data(), uid);
    const proposalId = tripChangeHash([data.tripId, uid, data.requestId]);
    const snapshot = await transaction.get(firestore.collection("tripChanges").doc(proposalId));
    if (!snapshot.exists) return { ...data, recorded: false, review: null };
    const { change } = await loadStoredTripChange(transaction, data.tripId, proposalId);
    if (change.driverUserId !== uid || change.requestId !== data.requestId)
      throw new HttpsError("failed-precondition", "Proposal identity requires reconciliation.");
    const state = await loadTripChangeState(transaction, data.tripId);
    return { ...data, recorded: true, review: tripChangeView(state, change, proposalId, uid) };
  });
}
