import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { guardianNextStatus, guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { requireRole } from "../lib/https.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

const label = (value: unknown): string | null => typeof value === "string" && value.trim() ? value : null;

export async function guardianParentOptions(uid: string, token: unknown, kind: "children" | "clubs", cursor?: string) {
  requireRole(token, "parent");
  const scope = JSON.stringify([uid, "guardian-parent-options", kind]);
  let query = kind === "children" ? firestore.collection("children").where("guardianUserIds", "array-contains", uid).orderBy(FieldPath.documentId())
    : firestore.collection("memberships").where("userId", "==", uid).orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
  return firestore.runTransaction(async (transaction) => {
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20), items = [];
    for (const doc of scanned) {
      if (kind === "children") {
        if (!isGuardianOfChild(doc.data(), uid)) throw new HttpsError("failed-precondition", "Child requires review.");
        items.push({ id: doc.id, name: label(doc.get("displayName")) });
      } else {
        const clubId = doc.get("clubId");
        if (!chatDocumentIdSchema.safeParse(clubId).success || doc.id !== membershipDocumentId(uid, clubId) ||
            !isActiveGuardianClubMember(doc.data(), uid, clubId)) continue;
        const club = await transaction.get(firestore.collection("clubs").doc(clubId));
        if (!club.exists || club.get("status") === "archived") continue;
        items.push({ id: clubId as string, name: label(club.get("name")) });
      }
    }
    return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}

export async function guardianParentView(uid: string, token: unknown, clubId: string, childId: string) {
  requireRole(token, "parent");
  const id = guardianVerificationId(clubId, childId, uid);
  return firestore.runTransaction(async (transaction) => {
    const [verification, child, club, membership] = await transaction.getAll(
      firestore.collection("guardianVerifications").doc(id), firestore.collection("children").doc(childId),
      firestore.collection("clubs").doc(clubId), firestore.collection("memberships").doc(membershipDocumentId(uid, clubId)));
    const parsed = guardianVerificationSchema.safeParse(verification.data());
    if (verification.exists && (!parsed.success || parsed.data.clubId !== clubId || parsed.data.childId !== childId || parsed.data.parentUserId !== uid)) {
      throw new HttpsError("failed-precondition", "The verification record requires review.");
    }
    const linked = child.exists && isGuardianOfChild(child.data(), uid);
    const eligible = linked && club.exists && club.get("status") !== "archived" &&
      isActiveGuardianClubMember(membership.data(), uid, clubId);
    if (!verification.exists && !eligible) throw new HttpsError("permission-denied", "Current child relationship and club membership are required.");
    const current = parsed.success ? parsed.data : undefined;
    const allowedActions = (["request", "withdraw"] as const).filter((action) =>
      guardianNextStatus(current?.status, action) && (action !== "request" || eligible));
    return { id, clubId, childId, parentUserId: uid, clubName: label(club.get("name")),
      childName: linked ? label(child.get("displayName")) : null,
      status: current?.status ?? null, revision: current?.revision ?? 0, allowedActions };
  });
}
