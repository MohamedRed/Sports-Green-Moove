import { FieldPath, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { nextTeamEnrollmentStatus, teamEnrollmentId, type TeamEnrollmentRecord, type TeamEnrollmentTarget } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { loadTeamEnrollmentSubject, readTeamEnrollment, requireEnrollmentRequester, requireTeamEnrollmentManager, teamBelongsToCurrentClub, teamContext, teamEnrollmentEligibility } from "./teamEnrollmentAuthority.js";

function label(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.length <= 120 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)
    ? value.trim() : null;
}
async function subjectLabel(transaction: Transaction, kind: TeamEnrollmentRecord["subjectKind"], id: string) {
  const subject = await transaction.get(firestore.collection(kind === "child" ? "children" : "users").doc(id));
  return label(subject.get("displayName"));
}
export async function teamEnrollmentView(uid: string, token: unknown, input: TeamEnrollmentTarget) {
  requireEnrollmentRequester(token, input.childId !== undefined);
  return firestore.runTransaction(async (transaction) => {
    const team = await transaction.get(firestore.collection("teams").doc(input.teamId)), context = teamContext(team);
    const subject = await loadTeamEnrollmentSubject(transaction, uid, input.childId);
    const { subjectKind: kind, subjectId } = subject;
    const id = teamEnrollmentId(context.teamInstanceId, kind, subjectId, subject.childCreatedAt);
    const current = readTeamEnrollment(await transaction.get(firestore.collection("teamEnrollments").doc(id)));
    const eligible = await teamEnrollmentEligibility(transaction, uid, context, subject);
    if (!eligible && (!current || current.requesterUserId !== uid)) throw new HttpsError("permission-denied", "Current enrollment or owned history is required.");
    const allowedActions: string[] = [];
    if (eligible && nextTeamEnrollmentStatus(current?.status, "request")) allowedActions.push("request");
    if (current?.requesterUserId === uid && nextTeamEnrollmentStatus(current.status, "withdraw") &&
        (kind === "member" || current.status === "requested" || eligible)) allowedActions.push("withdraw");
    return { id, teamId: context.teamId, clubId: context.clubId, teamInstanceId: context.teamInstanceId,
      teamName: label(team.get("name")), subjectKind: kind, subjectId,
      subjectName: eligible ? await subjectLabel(transaction, kind, subjectId) : null,
      status: current?.status ?? null, revision: current?.revision ?? 0, eligible, allowedActions };
  });
}
export async function clubTeamEnrollmentPage(uid: string, token: unknown, teamId: string, cursor?: string) {
  return firestore.runTransaction(async (transaction) => {
    const team = await transaction.get(firestore.collection("teams").doc(teamId)), context = teamContext(team);
    await requireTeamEnrollmentManager(transaction, uid, token, context.clubId);
    const club = await transaction.get(firestore.collection("clubs").doc(context.clubId));
    if (!teamBelongsToCurrentClub(context, club)) throw new HttpsError("permission-denied", "The team does not belong to the current club identity.");
    const scope = JSON.stringify([uid, "team-enrollment-review", context.teamInstanceId]);
    let query = firestore.collection("teamEnrollments").where("teamInstanceId", "==", context.teamInstanceId).orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(parseMembershipPageCursor(cursor, scope));
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20), items = [];
    for (const snapshot of scanned) {
      const current = readTeamEnrollment(snapshot)!;
      if (current.teamId !== teamId || current.clubId !== context.clubId || current.teamInstanceId !== context.teamInstanceId)
        throw new HttpsError("failed-precondition", "The enrollment does not belong to this team identity.");
      const eligible = await teamEnrollmentEligibility(transaction, current.requesterUserId, context, current);
      const name = eligible ? await subjectLabel(transaction, current.subjectKind, current.subjectId) : null;
      const actions = (["approve", "refuse", "revoke"] as const).filter((action) =>
        nextTeamEnrollmentStatus(current.status, action) && (action !== "approve" || eligible && name !== null));
      items.push({ id: snapshot.id, teamId, clubId: context.clubId, teamInstanceId: context.teamInstanceId,
        subjectKind: current.subjectKind, subjectId: current.subjectId, subjectName: name,
        status: current.status, revision: current.revision, allowedActions: actions });
    }
    return { teamId, teamInstanceId: context.teamInstanceId, teamName: label(team.get("name")), items,
      nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}
