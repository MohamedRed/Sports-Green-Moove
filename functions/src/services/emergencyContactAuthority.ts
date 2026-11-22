import type { Timestamp, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { emergencyChildInstanceId, type EmergencyTarget } from "../domain/emergencyContact.js";
import { guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireAnyRole, requireRole } from "../lib/https.js";

const atLeast = (verified: Timestamp, created: Timestamp) => verified.seconds > created.seconds ||
  verified.seconds === created.seconds && verified.nanoseconds >= created.nanoseconds;
function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 120 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value))
    throw new HttpsError("failed-precondition", "The contact subject requires review.");
  return value.trim();
}

export async function requireEmergencyContactAuthority(transaction: Transaction, uid: string, token: unknown, target: EmergencyTarget) {
  if (hasRole(token, "child")) throw new HttpsError("permission-denied", "A child cannot manage emergency contacts.");
  if (target.kind === "self") {
    requireAnyRole(token, ["parent", "driver", "clubManager"]);
    return { subjectId: uid };
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
      parsed.data.clubId !== clubId || parsed.data.childId !== childId || parsed.data.lastActorUserId === uid ||
      !child.exists || !child.createTime || !isGuardianOfChild(child.data(), uid) ||
      !club.exists || !club.createTime || club.get("status") === "archived" || !isActiveGuardianClubMember(membership.data(), uid, clubId) ||
      !atLeast(parsed.data.updatedAt, child.createTime) || !atLeast(parsed.data.updatedAt, club.createTime)) {
    throw new HttpsError("permission-denied", "A current verified parent relationship is required.");
  }
  return { subjectId: childId, clubId, childInstanceId: emergencyChildInstanceId(childId, child.createTime),
    childName: label(child.get("displayName")), clubName: label(club.get("name")) };
}
