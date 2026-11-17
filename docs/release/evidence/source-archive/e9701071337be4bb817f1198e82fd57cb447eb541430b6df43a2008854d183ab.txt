import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { firestoreDocumentIdSchema } from "../domain/firestoreDocumentId.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { canReviewMembership, membershipReviewSchema, membershipVersion, reviewDecisionSchema } from "../domain/membershipReview.js";
import { firestore } from "../lib/firebase.js";
import { requireAnyRole, requireAuth } from "../lib/https.js";
import { requireMembershipReviewer } from "../lib/membershipReviewAccess.js";
import { parseCallableData } from "../lib/validation.js";

const input = z.object({ membershipId: firestoreDocumentIdSchema, decision: reviewDecisionSchema,
  expectedVersion: z.string().regex(/^-?\d+\.\d{1,9}$/).max(32) }).strict();
export const reviewClubMembership = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAnyRole(request.auth?.token, ["admin", "clubManager"]);
  const { membershipId, decision, expectedVersion } = parseCallableData(input, request.data);
  const ref = firestore.collection("memberships").doc(membershipId);
  const event = firestore.collection("membershipReviews").doc();
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Membership not found.");
    const parsed = membershipReviewSchema.safeParse(snapshot.data());
    if (!parsed.success || !snapshot.updateTime) throw new HttpsError("failed-precondition", "Membership requires repair.");
    const member = parsed.data;
    if (snapshot.id !== membershipDocumentId(member.userId, member.clubId)) throw new HttpsError("failed-precondition", "Membership identity requires repair.");
    await requireMembershipReviewer(uid, request.auth?.token, member.clubId, transaction);
    const clubRef = firestore.collection("clubs").doc(member.clubId);
    const club = await transaction.get(clubRef);
    if (!club.exists || club.get("status") === "archived") throw new HttpsError("failed-precondition", "Club is not open for review.");
    if (!canReviewMembership(member) || membershipVersion(snapshot.updateTime) !== expectedVersion) {
      throw new HttpsError("failed-precondition", "The request changed. Reload before deciding.");
    }
    const count = club.get("memberCount");
    if (decision === "approve" && (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER)) {
      throw new HttpsError("failed-precondition", "Club member count requires repair.");
    }
    const now = Timestamp.now();
    const status = decision === "approve" ? "active" : "rejected";
    transaction.update(ref, { status, active: decision === "approve", reviewedByUserId: uid, reviewedAt: now, updatedAt: now });
    if (decision === "approve") transaction.update(clubRef, { memberCount: count + 1, updatedAt: now });
    transaction.create(event, { membershipId, clubId: member.clubId, userId: member.userId,
      decision, previousStatus: member.status, status, reviewerUserId: uid, requestVersion: expectedVersion, createdAt: now });
    transaction.create(firestore.collection("notifications").doc(event.id), { userId: member.userId,
      type: "membershipReviewed", title: decision === "approve" ? "Adhésion acceptée" : "Adhésion refusée",
      body: decision === "approve" ? "Votre demande d'adhésion a été acceptée." : "Votre demande d'adhésion a été refusée.",
      sourceId: membershipId, read: false, createdAt: now });
    return { membershipId, status, reviewId: event.id };
  });
});
