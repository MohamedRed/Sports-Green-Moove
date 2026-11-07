import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { firestore } from "../lib/firebase.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { loadTeamEnrollmentSubject, requireEnrollmentRequester, teamContext, teamEnrollmentEligibility } from "./teamEnrollmentAuthority.js";

const cursor = z.string().min(1).max(1600).optional();
export const teamEnrollmentOptionsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clubs"), cursor }).strict(),
  z.object({ kind: z.literal("teams"), clubId: chatDocumentIdSchema, cursor }).strict(),
  z.object({ kind: z.literal("children"), teamId: chatDocumentIdSchema, cursor }).strict(),
]);
export type TeamEnrollmentOptions = z.infer<typeof teamEnrollmentOptionsSchema>;
function name(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 120 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? value.trim() : null;
}
export async function teamEnrollmentOptions(uid: string, token: unknown, input: TeamEnrollmentOptions) {
  requireEnrollmentRequester(token, input.kind === "children");
  return firestore.runTransaction(async (transaction) => {
    const team = input.kind === "children" ? teamContext(await transaction.get(firestore.collection("teams").doc(input.teamId))) : null;
    const clubId = input.kind === "teams" ? input.clubId : team?.clubId;
    if (clubId) {
      const [club, member] = await transaction.getAll(firestore.collection("clubs").doc(clubId),
        firestore.collection("memberships").doc(membershipDocumentId(uid, clubId)));
      if (!club.exists || !["public", "private"].includes(club.get("status")) || team?.open === false ||
          !isActiveGuardianClubMember(member.data(), uid, clubId))
        throw new HttpsError("permission-denied", "Current club eligibility is required for team choices.");
    }
    const scope = JSON.stringify([uid, "team-enrollment-options", input.kind, team?.teamInstanceId ?? clubId ?? null]);
    let query = input.kind === "clubs" ? firestore.collection("memberships").where("userId", "==", uid).orderBy(FieldPath.documentId())
      : input.kind === "teams" ? firestore.collection("teams").where("clubId", "==", clubId).orderBy(FieldPath.documentId())
      : firestore.collection("children").where("guardianUserIds", "array-contains", uid).orderBy(FieldPath.documentId());
    if (input.cursor) query = query.startAfter(parseMembershipPageCursor(input.cursor, scope));
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20), items = [];
    for (const snapshot of scanned) {
      if (input.kind === "clubs") {
        const id = snapshot.get("clubId");
        if (!chatDocumentIdSchema.safeParse(id).success || snapshot.id !== membershipDocumentId(uid, id) ||
            !isActiveGuardianClubMember(snapshot.data(), uid, id)) continue;
        const club = await transaction.get(firestore.collection("clubs").doc(id));
        if (club.exists && ["public", "private"].includes(club.get("status"))) items.push({ id, name: name(club.get("name")) });
      } else if (input.kind === "teams") {
        const context = teamContext(snapshot);
        if (context.clubId !== clubId) throw new HttpsError("failed-precondition", "The team choice requires review.");
        if (context.open) items.push({ id: snapshot.id, name: name(snapshot.get("name")) });
      } else {
        const subject = await loadTeamEnrollmentSubject(transaction, uid, snapshot.id);
        if (await teamEnrollmentEligibility(transaction, uid, team!, subject)) items.push({ id: snapshot.id, name: name(snapshot.get("displayName")) });
      }
    }
    return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
