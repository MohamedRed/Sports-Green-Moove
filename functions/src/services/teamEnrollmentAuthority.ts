import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { isActiveClubManager } from "../domain/membershipReview.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { teamEnrollmentId, teamEnrollmentRecordSchema, teamInstanceId, timestampAtOrAfter, type TeamEnrollmentRecord } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireAnyRole, requireRole } from "../lib/https.js";

export function teamContext(snapshot: DocumentSnapshot) {
  const clubId = snapshot.get("clubId"), status = snapshot.get("status"), active = snapshot.get("active");
  if (!snapshot.exists || !snapshot.createTime || !chatDocumentIdSchema.safeParse(clubId).success ||
      status !== undefined && !["active", "archived", "inactive"].includes(status) || active !== undefined && typeof active !== "boolean")
    throw new HttpsError("failed-precondition", "The team identity requires review.");
  return { teamId: snapshot.id, clubId: clubId as string, teamCreatedAt: snapshot.createTime,
    teamInstanceId: teamInstanceId(snapshot.id, clubId, snapshot.createTime), open: active !== false && status !== "archived" && status !== "inactive" };
}
export function teamBelongsToCurrentClub(context: ReturnType<typeof teamContext>, club: DocumentSnapshot | undefined): boolean {
  return Boolean(club?.exists && club.id === context.clubId && timestampAtOrAfter(context.teamCreatedAt, club.createTime));
}
export function readTeamEnrollment(snapshot: DocumentSnapshot) {
  if (!snapshot.exists) return undefined;
  const parsed = teamEnrollmentRecordSchema.safeParse(snapshot.data());
  if (!parsed.success || snapshot.id !== teamEnrollmentId(parsed.data.teamInstanceId, parsed.data.subjectKind, parsed.data.subjectId, parsed.data.childCreatedAt) ||
      parsed.data.teamInstanceId !== teamInstanceId(parsed.data.teamId, parsed.data.clubId, parsed.data.teamCreatedAt))
    throw new HttpsError("failed-precondition", "The team enrollment requires review.");
  return parsed.data;
}
export function requireEnrollmentRequester(token: unknown, child: boolean) {
  if (hasRole(token, "child")) throw new HttpsError("permission-denied", "Child accounts cannot manage team enrollment.");
  if (child) requireRole(token, "parent"); else requireAnyRole(token, ["parent", "driver", "clubManager"]);
}
export async function requireTeamEnrollmentManager(transaction: Transaction, uid: string, token: unknown, clubId: string) {
  requireEnrollmentRequester(token, false);
  requireRole(token, "clubManager");
  const membership = await transaction.get(firestore.collection("memberships").doc(membershipDocumentId(uid, clubId)));
  if (!isActiveClubManager(membership.data(), uid, clubId)) throw new HttpsError("permission-denied", "Current team-club management authority is required.");
}
type EnrollmentSubject = Pick<TeamEnrollmentRecord, "subjectKind" | "subjectId" | "childCreatedAt">;
export async function loadTeamEnrollmentSubject(transaction: Transaction, uid: string, childId?: string): Promise<EnrollmentSubject> {
  if (childId === undefined) return { subjectKind: "member", subjectId: uid, childCreatedAt: null };
  const child = await transaction.get(firestore.collection("children").doc(childId));
  if (!child.exists || !child.createTime) throw new HttpsError("permission-denied", "An authorized child profile is required.");
  return { subjectKind: "child", subjectId: childId, childCreatedAt: child.createTime };
}
export async function teamEnrollmentEligibility(transaction: Transaction, uid: string, context: ReturnType<typeof teamContext>, subject: EnrollmentSubject) {
  const [club, membership] = await transaction.getAll(firestore.collection("clubs").doc(context.clubId),
    firestore.collection("memberships").doc(membershipDocumentId(uid, context.clubId)));
  if (!context.open || !teamBelongsToCurrentClub(context, club) || !["public", "private"].includes(club.get("status")) ||
      !isActiveGuardianClubMember(membership.data(), uid, context.clubId)) return false;
  if (subject.subjectKind === "member") return subject.subjectId === uid && subject.childCreatedAt === null;
  const childId = subject.subjectId;
  const [child, childMembership, verification] = await transaction.getAll(firestore.collection("children").doc(childId),
    firestore.collection("memberships").doc(membershipDocumentId(childId, context.clubId)),
    firestore.collection("guardianVerifications").doc(guardianVerificationId(context.clubId, childId, uid)));
  const parsed = guardianVerificationSchema.safeParse(verification.data());
  if (!child.exists || !child.createTime || !subject.childCreatedAt?.isEqual(child.createTime) || !isGuardianOfChild(child.data(), uid) ||
      !isActiveGuardianClubMember(childMembership.data(), childId, context.clubId) || !parsed.success) return false;
  const record = parsed.data, created = child.createTime;
  return record.clubId === context.clubId && record.childId === childId && record.parentUserId === uid &&
    record.status === "verified" && record.lastActorUserId !== uid &&
    timestampAtOrAfter(record.updatedAt, created) && timestampAtOrAfter(record.updatedAt, club.createTime);
}
