import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";
import { tripChangeHash, type tripChangeProposalSchema, type tripChangeDecisionSchema,
  type tripChangeWithdrawalSchema } from "../domain/tripChanges.js";
import { firestore } from "../lib/firebase.js";
import { changePrecondition, changeStillCurrent, loadStoredTripChange, loadTripChangeState, requireTripChangeDriver,
  requireTripChangeReader, tripChangeView, type StoredTripChange } from "./tripChangeState.js";
import { writeTripChangeNotices } from "./tripChangeNotices.js";

export async function previewTripChange(tripId: string, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const trip = await transaction.get(firestore.collection("trips").doc(tripId));
    if (!trip.exists) throw new HttpsError("not-found", "Trip not found.");
    requireTripChangeDriver(trip.data(), uid);
    const state = await loadTripChangeState(transaction, tripId);
    if (!state.available || state.trip.pendingChangeId) changePrecondition("Only an available trip without a pending change can be edited.");
    return { tripId, revision: state.revision, terms: state.terms, bookingCount: state.items.length,
      parentCount: new Set(state.items.map((item) => item.parentUserId)).size };
  });
}

export async function proposeTripChange(data: z.infer<typeof tripChangeProposalSchema>, uid: string) {
  const proposalId = tripChangeHash([data.tripId, uid, data.requestId]);
  return firestore.runTransaction(async (transaction) => {
    const trip = await transaction.get(firestore.collection("trips").doc(data.tripId));
    if (!trip.exists) throw new HttpsError("not-found", "Trip not found.");
    requireTripChangeDriver(trip.data(), uid);
    const ref = firestore.collection("tripChanges").doc(proposalId), existing = await transaction.get(ref);
    if (existing.exists) {
      const { change } = await loadStoredTripChange(transaction, data.tripId, proposalId);
      if (change.driverUserId !== uid || change.requestId !== data.requestId || change.expectedRevision !== data.expectedRevision ||
          tripChangeHash(change.terms) !== tripChangeHash(data.terms)) {
        throw new HttpsError("already-exists", "This request identity was used for different details.");
      }
      return tripChangeView(await loadTripChangeState(transaction, data.tripId), change, proposalId, uid);
    }
    const state = await loadTripChangeState(transaction, data.tripId);
    if (!state.available || state.trip.pendingChangeId) changePrecondition("Trip is not available for a new change proposal.");
    if (state.revision !== data.expectedRevision) throw new HttpsError("aborted", "Trip or reservations changed. Review the proposal again.");
    if (Date.parse(data.terms.departureAt) <= Date.now()) throw new HttpsError("invalid-argument", "Proposed departure must be in the future.");
    if (tripChangeHash(data.terms) === tripChangeHash(state.terms)) throw new HttpsError("invalid-argument", "The proposal must change trip details.");
    const now = Timestamp.now(), parents = [...new Set(state.items.map((item) => item.parentUserId))].sort();
    const change: StoredTripChange = { tripId: data.tripId, driverUserId: uid, requestId: data.requestId,
      expectedRevision: data.expectedRevision, revision: tripChangeHash([proposalId, data.expectedRevision, data.terms]),
      originalTerms: state.terms, terms: data.terms, bookingIds: state.items.map((item) => item.snapshot.id).sort(),
      parentUserIds: parents, decisions: {}, status: parents.length === 0 ? "confirmed" : "pending", createdAt: now, updatedAt: now };
    transaction.create(ref, change);
    transaction.update(state.tripRef, { pendingChangeId: proposalId, updatedAt: now });
    writeTripChangeNotices(transaction, proposalId, change, "proposed", now);
    return tripChangeView({ ...state, trip: { ...state.trip, pendingChangeId: proposalId } }, change, proposalId, uid);
  });
}

export async function reviewTripChange(tripId: string, proposalId: string, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const { change } = await loadStoredTripChange(transaction, tripId, proposalId);
    const state = await loadTripChangeState(transaction, tripId);
    const access = await requireTripChangeReader(transaction, state, change, uid);
    return tripChangeView(state, change, proposalId, uid, access.bookingIds);
  });
}

export async function respondTripChange(data: z.infer<typeof tripChangeDecisionSchema>, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const { ref, change } = await loadStoredTripChange(transaction, data.tripId, data.proposalId);
    const state = await loadTripChangeState(transaction, data.tripId);
    const access = await requireTripChangeReader(transaction, state, change, uid);
    if (access.role !== "parent")
      throw new HttpsError("permission-denied", "The driver cannot confirm on behalf of a parent.");
    if (data.proposalRevision !== change.revision) throw new HttpsError("aborted", "Review the exact proposed details again.");
    const previous = Object.hasOwn(change.decisions, uid) ? change.decisions[uid] : undefined;
    if (previous) {
      if (previous.requestId !== data.requestId || previous.decision !== data.decision)
        throw new HttpsError("already-exists", "A decision was already recorded for this parent and proposal.");
      return tripChangeView(state, change, data.proposalId, uid, access.bookingIds);
    }
    if (change.status !== "pending" || !changeStillCurrent(state, change, data.proposalId))
      changePrecondition("The proposal or its reservations changed. No decision was applied.");
    if (Date.parse(change.terms.departureAt) <= Date.now()) changePrecondition("The proposed departure has passed.");
    const now = Timestamp.now();
    const decisions = { ...change.decisions, [uid]: { requestId: data.requestId, decision: data.decision, decidedAt: now } };
    const status = data.decision === "decline" ? "declined" : change.parentUserIds.every((id) => decisions[id]?.decision === "accept") ? "confirmed" : "pending";
    const next: StoredTripChange = { ...change, decisions, status, updatedAt: now };
    transaction.update(ref, { decisions, status, updatedAt: now });
    if (status === "declined") transaction.update(state.tripRef, { pendingChangeId: FieldValue.delete(), updatedAt: now });
    if (status !== "pending") writeTripChangeNotices(transaction, data.proposalId, next, status, now);
    return tripChangeView(state, next, data.proposalId, uid, access.bookingIds);
  });
}

export async function withdrawTripChange(data: z.infer<typeof tripChangeWithdrawalSchema>, uid: string) {
  return firestore.runTransaction(async (transaction) => {
    const { ref, change } = await loadStoredTripChange(transaction, data.tripId, data.proposalId);
    const state = await loadTripChangeState(transaction, data.tripId);
    requireTripChangeDriver(state.trip, uid);
    if (change.driverUserId !== uid) throw new HttpsError("permission-denied", "Proposal owner does not match the trip driver.");
    if (change.status === "withdrawn") {
      if (change.withdrawalRequestId !== data.requestId) throw new HttpsError("already-exists", "Proposal was withdrawn by another request.");
      return tripChangeView(state, change, data.proposalId, uid);
    }
    if (!["pending", "confirmed"].includes(change.status) || state.trip.pendingChangeId !== data.proposalId)
      changePrecondition("Only this trip's current proposal can be withdrawn.");
    const now = Timestamp.now(), next: StoredTripChange = { ...change, status: "withdrawn", withdrawalRequestId: data.requestId, updatedAt: now };
    transaction.update(ref, { status: next.status, withdrawalRequestId: data.requestId, updatedAt: now });
    transaction.update(state.tripRef, { pendingChangeId: FieldValue.delete(), updatedAt: now });
    writeTripChangeNotices(transaction, data.proposalId, next, "withdrawn", now);
    return tripChangeView(state, next, data.proposalId, uid);
  });
}
