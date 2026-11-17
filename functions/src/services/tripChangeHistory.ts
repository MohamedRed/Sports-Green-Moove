import { FieldPath, Filter } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase.js";
import { parseTripHistoryCursor, tripHistoryCursor } from "../domain/tripChangeHistory.js";
import { loadStoredTripChange, loadTripChangeState, requireTripChangeReader, tripChangeView } from "./tripChangeState.js";
import { requireTripHistoryAccess } from "./tripHistoryAccess.js";

export async function listTripChangeHistory(tripId: string, uid: string, cursor?: string) {
  let query = firestore.collection("tripChanges").where("tripId", "==", tripId)
    .where(Filter.or(Filter.where("driverUserId", "==", uid), Filter.where("parentUserIds", "array-contains", uid)))
    .orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (cursor) query = query.startAfter(...parseTripHistoryCursor(cursor, uid, tripId));
  return firestore.runTransaction(async (transaction) => {
    const page = await transaction.get(query.limit(11));
    const state = await loadTripChangeState(transaction, tripId);
    await requireTripHistoryAccess(transaction, state, uid);
    const items = [];
    for (const snapshot of page.docs.slice(0, 10)) {
      const { change } = await loadStoredTripChange(transaction, tripId, snapshot.id);
      const access = await requireTripChangeReader(transaction, state, change, uid);
      const view = tripChangeView(state, change, snapshot.id, uid, access.bookingIds);
      items.push({ tripId, proposalId: view.proposalId, status: view.status, createdAt: view.createdAt,
        departureAt: view.terms.departureAt, priceCents: view.terms.priceCents });
    }
    const last = page.docs.slice(0, 10).at(-1);
    return { tripId, items, nextCursor: page.size > 10 && last
      ? tripHistoryCursor(uid, tripId, last.get("createdAt"), last.id) : null };
  });
}
