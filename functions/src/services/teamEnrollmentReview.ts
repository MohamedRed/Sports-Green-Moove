import { FieldPath } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { firestore } from "../lib/firebase.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { requireTeamEnrollmentManager, teamBelongsToCurrentClub, teamContext } from "./teamEnrollmentAuthority.js";

export async function teamEnrollmentReviewTeams(uid: string, token: unknown, clubId: string, cursor?: string) {
  return firestore.runTransaction(async (transaction) => {
    await requireTeamEnrollmentManager(transaction, uid, token, clubId);
    const club = await transaction.get(firestore.collection("clubs").doc(clubId));
    if (!club.exists || !club.createTime) throw new HttpsError("failed-precondition", "The club identity requires review.");
    const scope = JSON.stringify([uid, "team-enrollment-review-teams", clubId, [club.createTime.seconds, club.createTime.nanoseconds]]);
    let query = firestore.collection("teams").where("clubId", "==", clubId).orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20);
    const items = scanned.flatMap((snapshot) => {
      const context = teamContext(snapshot), name = snapshot.get("name");
      if (context.clubId !== clubId) throw new HttpsError("failed-precondition", "The team club identity changed.");
      if (!teamBelongsToCurrentClub(context, club)) return [];
      const label = typeof name === "string" && name.trim() && name.length <= 120 &&
        !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name) ? name.trim() : null;
      return [{ id: snapshot.id, clubId, teamInstanceId: context.teamInstanceId, name: label,
        open: context.open && ["public", "private"].includes(club.get("status")) }];
    });
    return { clubId, items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
