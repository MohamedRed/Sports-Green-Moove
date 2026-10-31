import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { guardianVerificationId, guardianVerificationSchema, isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import { adultTeamChatAccount, digest, earliestCurrentAdmission, latestAdmission, type TeamConversationTarget } from "../domain/teamConversation.js";
import { timestampAtOrAfter } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { hasRole } from "../lib/https.js";
import { readTeamEnrollment, teamBelongsToCurrentClub, teamContext, teamEnrollmentEligibility } from "./teamEnrollmentAuthority.js";

export async function requireTeamConversationAdult(transaction: Transaction, uid: string, token: unknown) {
  const [profile, childLogin] = await transaction.getAll(firestore.collection("users").doc(uid),
    firestore.collection("childAccountLinks").doc(uid));
  if (childLogin.exists || !adultTeamChatAccount(token, profile.data()))
    throw new HttpsError("permission-denied", "Team conversations are restricted to adult member accounts.");
  return profile;
}
export async function requireTeamConversationAccess(transaction: Transaction, uid: string, token: unknown, input: TeamConversationTarget) {
  const profile = await requireTeamConversationAdult(transaction, uid, token);
  const team = await transaction.get(firestore.collection("teams").doc(input.teamId));
  const context = teamContext(team);
  const [club, membership] = await transaction.getAll(firestore.collection("clubs").doc(context.clubId),
    firestore.collection("memberships").doc(membershipDocumentId(uid, context.clubId)));
  if (context.teamInstanceId !== input.expectedTeamInstanceId || !context.open || !teamBelongsToCurrentClub(context, club) ||
      !["public", "private"].includes(club.get("status")) || !isActiveGuardianClubMember(membership.data(), uid, context.clubId) ||
      !timestampAtOrAfter(membership.get("updatedAt"), club.createTime))
    throw new HttpsError("permission-denied", "Current team and club membership are required.");
  // A current approval is the history boundary, never a client-supplied date or legacy teamIds array.
  const approvals = await transaction.get(firestore.collection("teamEnrollments")
    .where("teamInstanceId", "==", context.teamInstanceId).where("status", "==", "approved").limit(201));
  if (approvals.size > 200) throw new HttpsError("resource-exhausted", "This team exceeds the supported conversation enrollment limit.");
  const admissions: Timestamp[] = [], identities: unknown[] = [];
  for (const snapshot of approvals.docs) {
    const entry = readTeamEnrollment(snapshot)!;
    if (entry.teamId !== context.teamId || entry.clubId !== context.clubId || entry.teamInstanceId !== context.teamInstanceId)
      throw new HttpsError("failed-precondition", "The team enrollment identity requires review.");
    if (entry.subjectKind === "member" && entry.subjectId !== uid) continue;
    let guardianAt: Timestamp | undefined, childMembershipAt: Timestamp | undefined, guardianRevision: number | undefined;
    if (entry.subjectKind === "child") {
      if (!hasRole(token, "parent") || profile.get("roles.parent") !== true) continue;
      const child = await transaction.get(firestore.collection("children").doc(entry.subjectId));
      if (!child.exists || !isGuardianOfChild(child.data(), uid)) continue;
      const verified = await transaction.get(firestore.collection("guardianVerifications")
        .doc(guardianVerificationId(context.clubId, entry.subjectId, uid)));
      const parsed = guardianVerificationSchema.safeParse(verified.data());
      if (!parsed.success || parsed.data.status !== "verified") continue;
      guardianAt = parsed.data.updatedAt; guardianRevision = parsed.data.revision;
      const childMembership = await transaction.get(firestore.collection("memberships").doc(membershipDocumentId(entry.subjectId, context.clubId)));
      if (!timestampAtOrAfter(childMembership.get("updatedAt"), club.createTime)) continue;
      childMembershipAt = childMembership.get("updatedAt");
    }
    if (!await teamEnrollmentEligibility(transaction, uid, context, entry)) continue;
    let admittedAt;
    try { admittedAt = latestAdmission(entry.updatedAt, membership.get("updatedAt"), ...(guardianAt ? [guardianAt, childMembershipAt] : [])); }
    catch { throw new HttpsError("failed-precondition", "Conversation admission metadata requires review."); }
    if (!timestampAtOrAfter(admittedAt, context.teamCreatedAt) || !timestampAtOrAfter(Timestamp.now(), admittedAt))
      throw new HttpsError("failed-precondition", "Conversation admission time requires review.");
    admissions.push(admittedAt);
    identities.push([snapshot.id, entry.revision, guardianRevision ?? null, admittedAt.seconds, admittedAt.nanoseconds]);
  }
  if (!admissions.length) throw new HttpsError("permission-denied", "Approved team membership or verified parent authority is required.");
  const availableAfter = earliestCurrentAdmission(admissions);
  return { ...context, availableAfter, accessVersion: digest([uid, identities]),
    title: typeof team.get("name") === "string" ? team.get("name") as string : null };
}
