import { FieldPath, Filter } from "firebase-admin/firestore";
import { z } from "zod";
import { buildInboxReviewPrompts } from "../domain/inbox.js";
import { REVIEW_SCAN_SIZE, selectPendingReviews } from "../domain/pendingReviews.js";
import { attachReviewTripContexts, pendingReviewTripIds } from "../domain/reviewTripContext.js";
import { firestore } from "../lib/firebase.js";
import { membershipCursorSchema, membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

export const pendingReviewInput = z.object({ cursor: membershipCursorSchema.optional() }).strict();

export async function pendingReviewPage(uid: string, cursor?: string) {
  const scope = `pending-reviews:${uid}`;
  let query = firestore.collection("rideSessions").where("status", "==", "completed")
    .where(Filter.or(Filter.where("participantUserIds", "array-contains", uid), Filter.where("driverUserId", "==", uid)))
    .orderBy(FieldPath.documentId(), "asc");
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  const snapshot = await query.limit(REVIEW_SCAN_SIZE + 1).get();
  const rides = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  const candidates = buildInboxReviewPrompts(rides.slice(0, REVIEW_SCAN_SIZE), new Set(), uid);
  const ratings = candidates.length ? await firestore.getAll(...candidates.map(review => firestore.doc(`ratings/${review.id}`))) : [];
  const selected = selectPendingReviews(rides, new Set(ratings.filter(doc => doc.exists).map(doc => doc.id)), uid);
  const tripIds = pendingReviewTripIds(selected.items, rides);
  const trips = tripIds.length ? await firestore.getAll(...tripIds.map(id => firestore.doc(`trips/${id}`))) : [];
  const items = attachReviewTripContexts(selected.items, rides, trips.filter(doc => doc.exists).map(doc => ({id: doc.id, data: doc.data()!})));
  return { userId: uid, items, nextCursor: selected.hasMore && selected.lastScannedId
    ? membershipPageCursor(scope, selected.lastScannedId) : null };
}
