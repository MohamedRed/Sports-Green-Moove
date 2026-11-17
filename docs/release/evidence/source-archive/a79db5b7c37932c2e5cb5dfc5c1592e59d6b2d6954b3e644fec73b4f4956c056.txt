import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { isActiveGuardianClubMember } from "../domain/guardianVerification.js";
import { membershipDocumentId } from "../domain/memberships.js";
import { teamConversationLabel } from "../domain/teamConversation.js";
import { timestampAtOrAfter } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { membershipCursorSchema, membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { requireTeamConversationAccess, requireTeamConversationAdult } from "./teamConversationAuthority.js";
import { teamContext } from "./teamEnrollmentAuthority.js";

export const teamChatOptionsSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clubs"), cursor: membershipCursorSchema.optional() }).strict(),
  z.object({ kind: z.literal("teams"), clubId: chatDocumentIdSchema, cursor: membershipCursorSchema.optional() }).strict(),
]);
export async function teamConversationOptions(uid: string, token: unknown, input: z.infer<typeof teamChatOptionsSchema>) {
  return firestore.runTransaction(async transaction => {
    await requireTeamConversationAdult(transaction, uid, token);
    const clubId = input.kind === "teams" ? input.clubId : null;
    let clubIdentity: unknown = null;
    if (clubId) {
      const [club, member] = await transaction.getAll(firestore.collection("clubs").doc(clubId),
        firestore.collection("memberships").doc(membershipDocumentId(uid, clubId)));
      if (!club.exists || !["public", "private"].includes(club.get("status")) ||
          !isActiveGuardianClubMember(member.data(), uid, clubId) || !timestampAtOrAfter(member.get("updatedAt"), club.createTime))
        throw new HttpsError("permission-denied", "Current club membership is required.");
      clubIdentity = [club.createTime!.seconds, club.createTime!.nanoseconds];
    }
    const scope = JSON.stringify([uid, "team-chat-options", input.kind, clubId, clubIdentity]);
    let query = input.kind === "clubs" ? firestore.collection("memberships").where("userId", "==", uid).orderBy(FieldPath.documentId())
      : firestore.collection("teams").where("clubId", "==", clubId).orderBy(FieldPath.documentId());
    if (input.cursor) query = query.startAfter(parseMembershipPageCursor(input.cursor, scope));
    // Bound transaction work per page while keeping a cursor for scanned but unauthorized teams.
    const page = await transaction.get(query.limit(6)), scanned = page.docs.slice(0, 5);
    const items: { id: string; name: string | null; teamInstanceId: string | null }[] = [];
    for (const snapshot of scanned) {
      if (input.kind === "clubs") {
        const id = snapshot.get("clubId");
        if (!chatDocumentIdSchema.safeParse(id).success || snapshot.id !== membershipDocumentId(uid, id) ||
            !isActiveGuardianClubMember(snapshot.data(), uid, id)) continue;
        const club = await transaction.get(firestore.collection("clubs").doc(id));
        if (club.exists && ["public", "private"].includes(club.get("status")) && timestampAtOrAfter(snapshot.get("updatedAt"), club.createTime))
          items.push({ id, name: teamConversationLabel(club.get("name")), teamInstanceId: null });
      } else {
        const team = teamContext(snapshot);
        try {
          const access = await requireTeamConversationAccess(transaction, uid, token,
            { teamId: snapshot.id, expectedTeamInstanceId: team.teamInstanceId });
          if (access.clubId !== clubId) throw new HttpsError("failed-precondition", "Team club identity changed.");
          items.push({ id: snapshot.id, name: teamConversationLabel(access.title), teamInstanceId: access.teamInstanceId });
        } catch (error) {
          if (!(error instanceof HttpsError) || error.code !== "permission-denied") throw error;
        }
      }
    }
    return { currentUserId: uid, kind: input.kind, clubId, items,
      nextCursor: page.size > 5 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
