import { FieldPath, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { guardianNextStatus, guardianVerificationId, guardianVerificationSchema,
  isActiveGuardianClubMember, type GuardianTransition } from "../domain/guardianVerification.js";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { isActiveClubManager } from "../domain/membershipReview.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { requireRole } from "../lib/https.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

const clubRef = (clubId: string) => firestore.collection("clubs").doc(clubId);
const memberRef = (uid: string, clubId: string) => firestore.collection("memberships").doc(membershipDocumentId(uid, clubId));
const name = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;

async function requireManager(transaction: Transaction, uid: string, clubId: string) {
  const member = await transaction.get(memberRef(uid, clubId));
  if (!isActiveClubManager(member.data(), uid, clubId)) {
    throw new HttpsError("permission-denied", "Current management authority over this club is required.");
  }
}

export async function guardianReviewClubs(uid: string, token: unknown, cursor?: string) {
  requireRole(token, "clubManager");
  const scope = JSON.stringify([uid, "guardian-review-clubs"]);
  let query = firestore.collection("memberships").where("userId", "==", uid).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  return firestore.runTransaction(async (transaction) => {
    const page = await transaction.get(query.limit(21));
    const scanned = page.docs.slice(0, 20), items = [];
    for (const doc of scanned) {
      const clubId = doc.get("clubId");
      if (!chatDocumentIdSchema.safeParse(clubId).success || !isActiveClubManager(doc.data(), uid, clubId) ||
          doc.id !== membershipDocumentId(uid, clubId)) continue;
      const club = await transaction.get(clubRef(clubId));
      const label = name(club.get("name"));
      if (!club.exists || !label) throw new HttpsError("failed-precondition", "Club requires review.");
      items.push({ id: clubId as string, name: label });
    }
    return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}

export async function guardianVerificationList(uid: string, token: unknown, clubId?: string, cursor?: string) {
  const reviewing = clubId !== undefined;
  requireRole(token, reviewing ? "clubManager" : "parent");
  const scope = JSON.stringify([uid, reviewing ? "guardian-club" : "guardian-parent", clubId ?? null]);
  let query = firestore.collection("guardianVerifications")
    .where(reviewing ? "clubId" : "parentUserId", "==", clubId ?? uid).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  return firestore.runTransaction(async (transaction) => {
    if (reviewing) await requireManager(transaction, uid, clubId);
    const page = await transaction.get(query.limit(21));
    const scanned = page.docs.slice(0, 20), items = [];
    for (const doc of scanned) {
      const parsed = guardianVerificationSchema.safeParse(doc.data());
      if (!parsed.success || guardianVerificationId(parsed.data.clubId, parsed.data.childId, parsed.data.parentUserId) !== doc.id ||
          (reviewing ? parsed.data.clubId !== clubId : parsed.data.parentUserId !== uid)) {
        throw new HttpsError("failed-precondition", "A verification record requires review.");
      }
      const record = parsed.data;
      const [club, child, parent, membership] = await transaction.getAll(clubRef(record.clubId),
        firestore.collection("children").doc(record.childId), firestore.collection("users").doc(record.parentUserId),
        memberRef(record.parentUserId, record.clubId));
      const linked = child.exists && isGuardianOfChild(child.data(), record.parentUserId);
      const member = isActiveGuardianClubMember(membership.data(), record.parentUserId, record.clubId);
      const eligible = club.exists && club.get("status") !== "archived" && linked && member;
      const actions: GuardianTransition["action"][] = reviewing
        ? uid === record.parentUserId ? [] : ["verify", "refuse", "revoke"] : ["request", "withdraw"];
      const allowedActions = actions.filter((action) => guardianNextStatus(record.status, action) &&
        (!["request", "verify"].includes(action) || eligible));
      items.push({ id: doc.id, clubId: record.clubId, clubName: name(club.get("name")),
        childId: record.childId, childName: linked && (!reviewing || member) ? name(child.get("displayName")) : null,
        parentUserId: record.parentUserId, parentName: !reviewing || member ? name(parent.get("displayName")) : null,
        status: record.status, revision: record.revision, allowedActions });
    }
    return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
