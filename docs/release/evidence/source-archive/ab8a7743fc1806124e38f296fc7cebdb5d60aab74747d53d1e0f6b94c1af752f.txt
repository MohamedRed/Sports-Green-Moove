import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { isActiveClubManager } from "../domain/membershipReview.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { firestore } from "./firebase.js";
import { hasRole, requireAnyRole } from "./https.js";

export async function requireMembershipReviewer(uid: string, token: unknown, clubId: string, transaction?: Transaction): Promise<void> {
  requireAnyRole(token, ["admin", "clubManager"]);
  if (hasRole(token, "admin")) return;
  const ref = firestore.collection("memberships").doc(membershipDocumentId(uid, clubId));
  const member = transaction ? await transaction.get(ref) : await ref.get();
  if (!isActiveClubManager(member.data(), uid, clubId)) {
    throw new HttpsError("permission-denied", "Active club management membership is required.");
  }
}
