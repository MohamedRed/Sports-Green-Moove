import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { childAccountLinkSchema } from "../domain/childAccountLink.js";
import { emergencyChildInstanceId, emergencyContactId, emergencyContactRecordSchema, legacyChildEmergencyContactId } from "../domain/emergencyContact.js";
import { guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { firestore } from "../lib/firebase.js";
import { requireRole } from "../lib/https.js";

const atLeast = (value: unknown, minimum: unknown) => value instanceof Timestamp && minimum instanceof Timestamp &&
  (value.seconds > minimum.seconds || value.seconds === minimum.seconds && value.nanoseconds >= minimum.nanoseconds);
const denied = () => new HttpsError("permission-denied", "A current child ride and verified parent contact are required.");

export async function readChildRideEmergencyContact(uid: string, token: unknown, rideSessionId: string) {
  requireRole(token, "child");
  return firestore.runTransaction(async (transaction) => {
    const link = childAccountLinkSchema.safeParse((await transaction.get(firestore.collection("childAccountLinks").doc(uid))).data());
    if (!link.success || link.data.status !== "verified" || link.data.accountUserId !== uid || link.data.verifiedByUserId === uid) throw denied();
    const childId = link.data.childId;
    const [child, ride] = await transaction.getAll(firestore.collection("children").doc(childId),
      firestore.collection("rideSessions").doc(rideSessionId));
    const ids: unknown = ride.get("childUserIds"), passengers: unknown = ride.get("passengers");
    if (!child.exists || !child.createTime || !ride.exists || ride.get("status") !== "active" ||
        !atLeast(link.data.verifiedAt, child.createTime) ||
        !atLeast(ride.get("startedAt"), child.createTime) || !Array.isArray(ids) || !ids.includes(childId) ||
        !Array.isArray(passengers) || !passengers.some((row) => row && typeof row === "object" && row.childId === childId)) throw denied();
    const childInstanceId = emergencyChildInstanceId(childId, child.createTime);
    if (link.data.childInstanceId !== childInstanceId) throw denied();
    const [snapshot, legacy] = await transaction.getAll(
      firestore.collection("emergencyContacts").doc(emergencyContactId("child", childId, childInstanceId)),
      firestore.collection("emergencyContacts").doc(legacyChildEmergencyContactId(childId)));
    if (legacy.exists) throw new HttpsError("failed-precondition", "An unbound legacy contact requires explicit review.");
    let contact = null, revision = 0;
    if (snapshot.exists) {
      const parsed = emergencyContactRecordSchema.safeParse(snapshot.data());
      if (!parsed.success || parsed.data.kind !== "child" || parsed.data.subjectId !== childId || parsed.data.childInstanceId !== childInstanceId ||
          !parsed.data.guardianClubId || !atLeast(parsed.data.updatedAt, child.createTime))
        throw new HttpsError("failed-precondition", "The parent contact authorization requires review.");
      const clubId = parsed.data.guardianClubId, record = parsed.data, parentId = record.lastActorUserId;
      const [parent, club, membership, verification] = await transaction.getAll(
        firestore.collection("users").doc(parentId), firestore.collection("clubs").doc(clubId),
        firestore.collection("memberships").doc(membershipDocumentId(parentId, clubId)),
        firestore.collection("guardianVerifications").doc(guardianVerificationId(clubId, childId, parentId)));
      const verified = guardianVerificationSchema.safeParse(verification.data()), roles: unknown = parent.get("roles");
      if (parentId === uid || !parent.exists || !roles || typeof roles !== "object" ||
          !("parent" in roles) || roles.parent !== true || "child" in roles && roles.child === true ||
          !club.exists || !["public", "private"].includes(club.get("status")) ||
          !isActiveGuardianClubMember(membership.data(), parentId, clubId) || !isGuardianOfChild(child.data(), parentId) ||
          !verified.success || verified.data.clubId !== clubId || verified.data.childId !== childId || verified.data.parentUserId !== parentId ||
          verified.data.status !== "verified" || verified.data.lastActorUserId === parentId ||
          !atLeast(verified.data.updatedAt, child.createTime) || !atLeast(verified.data.updatedAt, club.createTime)) throw denied();
      contact = record.contact; revision = record.revision;
    }
    const name: unknown = child.get("displayName");
    if (typeof name !== "string" || !name.trim() || name.length > 120 ||
        /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name))
      throw new HttpsError("failed-precondition", "The current child profile requires review.");
    return { accountUserId: uid, rideSessionId, subjectId: childId, childInstanceId, childName: name.trim(), contact, revision };
  });
}
