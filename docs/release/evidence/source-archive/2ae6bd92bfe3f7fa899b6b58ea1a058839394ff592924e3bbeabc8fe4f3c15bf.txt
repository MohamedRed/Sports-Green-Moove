import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { EmergencyTarget } from "../domain/emergencyContact.js";
import { guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireAnyRole, requireRole } from "../lib/https.js";

export async function requireEmergencyContactAuthority(transaction: Transaction, uid: string, token: unknown, target: EmergencyTarget) {
  if (hasRole(token, "child")) throw new HttpsError("permission-denied", "A child cannot manage emergency contacts.");
  if (target.kind === "self") {
    requireAnyRole(token, ["parent", "driver", "clubManager"]);
    return uid;
  }
  requireRole(token, "parent");
  const { childId, clubId } = target;
  const [verification, child, membership, club] = await transaction.getAll(
    firestore.collection("guardianVerifications").doc(guardianVerificationId(clubId, childId, uid)),
    firestore.collection("children").doc(childId),
    firestore.collection("memberships").doc(membershipDocumentId(uid, clubId)),
    firestore.collection("clubs").doc(clubId));
  const parsed = guardianVerificationSchema.safeParse(verification.data());
  if (!parsed.success || parsed.data.status !== "verified" || parsed.data.parentUserId !== uid ||
      parsed.data.clubId !== clubId || parsed.data.childId !== childId || !child.exists || !isGuardianOfChild(child.data(), uid) ||
      !club.exists || club.get("status") === "archived" || !isActiveGuardianClubMember(membership.data(), uid, clubId)) {
    throw new HttpsError("permission-denied", "A current verified parent relationship is required.");
  }
  return childId;
}
