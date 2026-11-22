import { FieldPath, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { nextTeamEnrollmentStatus } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { hasRole } from "../lib/https.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { readTeamEnrollment, requireEnrollmentRequester, teamContext, teamEnrollmentEligibility } from "./teamEnrollmentAuthority.js";

function label(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 120 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? value.trim() : null;
}
async function ownedView(transaction: Transaction, uid: string, token: unknown, snapshot: DocumentSnapshot) {
  const current = readTeamEnrollment(snapshot);
  if (!current || current.requesterUserId !== uid) throw new HttpsError("permission-denied", "An owned enrollment is required.");
  const team = await transaction.get(firestore.collection("teams").doc(current.teamId));
  const context = team.exists ? teamContext(team) : null;
  const sameTeam = context?.teamInstanceId === current.teamInstanceId;
  const childAuthority = current.subjectKind !== "child" || hasRole(token, "parent");
  const eligible = sameTeam && childAuthority && await teamEnrollmentEligibility(transaction, uid, context!, current);
  let subjectName: string | null = null;
  if (eligible) {
    const subject = await transaction.get(firestore.collection(current.subjectKind === "child" ? "children" : "users").doc(current.subjectId));
    subjectName = label(subject.get("displayName"));
  }
  const mayWithdraw = childAuthority && nextTeamEnrollmentStatus(current.status, "withdraw") &&
    (current.subjectKind === "member" || current.status === "requested" || eligible);
  return { id: snapshot.id, requesterUserId: uid, teamId: current.teamId, clubId: current.clubId,
    teamInstanceId: current.teamInstanceId, teamName: sameTeam ? label(team.get("name")) : null,
    subjectKind: current.subjectKind, subjectId: current.subjectId, subjectName,
    status: current.status, revision: current.revision, eligible, allowedActions: mayWithdraw ? ["withdraw"] : [] };
}
export async function ownedTeamEnrollmentView(uid: string, token: unknown, enrollmentId: string) {
  requireEnrollmentRequester(token, false);
  return firestore.runTransaction(async (transaction) => ownedView(transaction, uid, token,
    await transaction.get(firestore.collection("teamEnrollments").doc(enrollmentId))));
}
export async function ownedTeamEnrollmentPage(uid: string, token: unknown, cursor?: string) {
  requireEnrollmentRequester(token, false);
  return firestore.runTransaction(async (transaction) => {
    const scope = JSON.stringify([uid, "owned-team-enrollments"]);
    let query = firestore.collection("teamEnrollments").where("requesterUserId", "==", uid).orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20), items = [];
    for (const snapshot of scanned) items.push(await ownedView(transaction, uid, token, snapshot));
    return { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
