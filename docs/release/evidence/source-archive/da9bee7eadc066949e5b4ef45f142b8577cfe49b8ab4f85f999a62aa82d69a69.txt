import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { guardianNextStatus, guardianOperationDigest, guardianOperationId, guardianVerificationId,
  guardianVerificationSchema, isActiveGuardianClubMember, type GuardianTransition } from "../domain/guardianVerification.js";
import { isActiveClubManager } from "../domain/membershipReview.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { requireRole } from "../lib/https.js";

export async function transitionGuardianVerificationRecord(uid: string, token: unknown, input: GuardianTransition) {
  const managerAction = ["verify", "refuse", "revoke"].includes(input.action);
  requireRole(token, managerAction ? "clubManager" : "parent");
  if (managerAction ? uid === input.parentUserId : uid !== input.parentUserId) {
    throw new HttpsError("permission-denied", "A parent cannot verify their own relationship or act for another parent.");
  }
  const id = guardianVerificationId(input.clubId, input.childId, input.parentUserId);
  const ref = firestore.collection("guardianVerifications").doc(id);
  const event = firestore.collection("guardianVerificationEvents").doc(guardianOperationId(uid, input.requestId));
  return firestore.runTransaction(async (transaction) => {
    const [snapshot, previousEvent, club, child, parentMembership] = await transaction.getAll(ref, event,
      firestore.collection("clubs").doc(input.clubId), firestore.collection("children").doc(input.childId),
      firestore.collection("memberships").doc(membershipDocumentId(input.parentUserId, input.clubId)));
    if (managerAction) {
      const manager = await transaction.get(firestore.collection("memberships").doc(membershipDocumentId(uid, input.clubId)));
      if (!isActiveClubManager(manager.data(), uid, input.clubId)) {
        throw new HttpsError("permission-denied", "Current management authority over this club is required.");
      }
    }
    const granting = input.action === "request" || input.action === "verify";
    if (granting && (!club.exists || club.get("status") === "archived" ||
        !isActiveGuardianClubMember(parentMembership.data(), input.parentUserId, input.clubId) ||
        !child.exists || !isGuardianOfChild(child.data(), input.parentUserId))) {
      throw new HttpsError("permission-denied", "A current club membership and declared child relationship are required.");
    }
    const parsed = guardianVerificationSchema.safeParse(snapshot.data());
    if (snapshot.exists && (!parsed.success || parsed.data.childId !== input.childId ||
        parsed.data.clubId !== input.clubId || parsed.data.parentUserId !== input.parentUserId)) {
      throw new HttpsError("failed-precondition", "The verification record requires review.");
    }
    const current = parsed.success ? parsed.data : undefined;
    const fingerprint = guardianOperationDigest(input);
    if (previousEvent.exists) {
      if (previousEvent.get("fingerprint") !== fingerprint || previousEvent.get("verificationId") !== id ||
          previousEvent.get("actorUserId") !== uid || !current) {
        throw new HttpsError("already-exists", "This operation identity belongs to a different request.");
      }
      return { verificationId: id, status: current.status, revision: current.revision, replayed: true };
    }
    const next = guardianNextStatus(current?.status, input.action);
    if (!next || (current?.revision ?? 0) !== input.expectedRevision) {
      throw new HttpsError("failed-precondition", "The verification changed. Reload before deciding.");
    }
    const now = Timestamp.now(), revision = input.expectedRevision + 1;
    const record = { childId: input.childId, parentUserId: input.parentUserId, clubId: input.clubId,
      status: next, revision, lastActorUserId: uid, updatedAt: now };
    if (snapshot.exists) transaction.update(ref, record);
    else transaction.create(ref, { ...record, createdAt: now });
    transaction.create(event, { verificationId: id, actorUserId: uid, childId: input.childId,
      parentUserId: input.parentUserId, clubId: input.clubId, action: input.action,
      previousStatus: current?.status ?? null, status: next, revision, fingerprint, createdAt: now });
    return { verificationId: id, status: next, revision, replayed: false };
  });
}
