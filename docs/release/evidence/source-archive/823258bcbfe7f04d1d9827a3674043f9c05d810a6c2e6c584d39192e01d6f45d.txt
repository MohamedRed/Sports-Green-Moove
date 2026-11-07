import { Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { nextTeamEnrollmentStatus, teamEnrollmentFingerprint, teamEnrollmentId, teamEnrollmentOperationId,
  type TeamEnrollmentRecord, type TeamEnrollmentRequest, type TeamEnrollmentTransition } from "../domain/teamEnrollment.js";
import { firestore } from "../lib/firebase.js";
import { loadTeamEnrollmentSubject, readTeamEnrollment, requireEnrollmentRequester, requireTeamEnrollmentManager, teamContext, teamEnrollmentEligibility } from "./teamEnrollmentAuthority.js";

function receipt(id: string, record: TeamEnrollmentRecord, replayed: boolean) {
  return { enrollmentId: id, teamId: record.teamId, teamInstanceId: record.teamInstanceId, status: record.status, revision: record.revision, replayed };
}
function replay(uid: string, id: string, input: TeamEnrollmentRequest | TeamEnrollmentTransition, event: DocumentSnapshot, current: TeamEnrollmentRecord | undefined) {
  if (!event.exists) return null;
  if (!current || event.get("actorUserId") !== uid || event.get("enrollmentId") !== id || event.get("fingerprint") !== teamEnrollmentFingerprint(input))
    throw new HttpsError("already-exists", "This operation identity belongs to another enrollment request.");
  return receipt(id, current, true);
}
function writeTransition(transaction: Transaction, uid: string, id: string, input: TeamEnrollmentRequest | TeamEnrollmentTransition,
    action: "request" | TeamEnrollmentTransition["action"], values: Omit<TeamEnrollmentRecord, "status" | "revision" | "lastActorUserId" | "createdAt" | "updatedAt">,
    current?: TeamEnrollmentRecord) {
  const next = nextTeamEnrollmentStatus(current?.status, action);
  if (!next || (current?.revision ?? 0) !== input.expectedRevision) throw new HttpsError("failed-precondition", "The enrollment changed. Read it again before deciding.");
  const now = Timestamp.now(), record: TeamEnrollmentRecord = { ...values, status: next, revision: input.expectedRevision + 1,
    lastActorUserId: uid, createdAt: current?.createdAt ?? now, updatedAt: now };
  transaction.set(firestore.collection("teamEnrollments").doc(id), record);
  transaction.create(firestore.collection("teamEnrollmentEvents").doc(teamEnrollmentOperationId(uid, input.requestId)), {
    enrollmentId: id, teamId: values.teamId, teamInstanceId: values.teamInstanceId, clubId: values.clubId,
    subjectKind: values.subjectKind, subjectId: values.subjectId, requesterUserId: values.requesterUserId,
    actorUserId: uid, action, previousStatus: current?.status ?? null, status: next, revision: record.revision,
    fingerprint: teamEnrollmentFingerprint(input), createdAt: now });
  return receipt(id, record, false);
}
export async function requestTeamEnrollmentRecord(uid: string, token: unknown, input: TeamEnrollmentRequest) {
  requireEnrollmentRequester(token, input.childId !== undefined);
  return firestore.runTransaction(async (transaction) => {
    const team = teamContext(await transaction.get(firestore.collection("teams").doc(input.teamId)));
    if (team.teamInstanceId !== input.expectedTeamInstanceId) throw new HttpsError("failed-precondition", "The selected team identity changed.");
    const subject = await loadTeamEnrollmentSubject(transaction, uid, input.childId);
    if (!await teamEnrollmentEligibility(transaction, uid, team, subject)) throw new HttpsError("permission-denied", "Current club and verified-parent eligibility are required.");
    const id = teamEnrollmentId(team.teamInstanceId, subject.subjectKind, subject.subjectId, subject.childCreatedAt);
    if (id !== input.expectedEnrollmentId) throw new HttpsError("failed-precondition", "The viewed enrollment identity changed.");
    const [snapshot, event] = await transaction.getAll(firestore.collection("teamEnrollments").doc(id),
      firestore.collection("teamEnrollmentEvents").doc(teamEnrollmentOperationId(uid, input.requestId)));
    const current = readTeamEnrollment(snapshot), previous = replay(uid, id, input, event, current);
    if (previous) return previous;
    return writeTransition(transaction, uid, id, input, "request", { teamId: team.teamId, teamInstanceId: team.teamInstanceId,
      teamCreatedAt: team.teamCreatedAt, clubId: team.clubId, ...subject, requesterUserId: uid }, current);
  });
}
export async function transitionTeamEnrollmentRecord(uid: string, token: unknown, input: TeamEnrollmentTransition) {
  return firestore.runTransaction(async (transaction) => {
    const [snapshot, event] = await transaction.getAll(firestore.collection("teamEnrollments").doc(input.enrollmentId),
      firestore.collection("teamEnrollmentEvents").doc(teamEnrollmentOperationId(uid, input.requestId)));
    const current = readTeamEnrollment(snapshot);
    if (!current) throw new HttpsError("permission-denied", "An authorized enrollment is required.");
    if (input.action === "withdraw") {
      requireEnrollmentRequester(token, current.subjectKind === "child");
      if (current.requesterUserId !== uid) throw new HttpsError("permission-denied", "Only the requesting account can withdraw its enrollment request.");
    } else await requireTeamEnrollmentManager(transaction, uid, token, current.clubId);
    if (input.action === "approve" || input.action === "withdraw" && current.subjectKind === "child" && current.status === "approved") {
      const team = teamContext(await transaction.get(firestore.collection("teams").doc(current.teamId)));
      if (team.teamInstanceId !== current.teamInstanceId || !await teamEnrollmentEligibility(transaction, current.requesterUserId,
        team, current)) throw new HttpsError("permission-denied", "The current team enrollment eligibility no longer holds.");
    }
    const previous = replay(uid, input.enrollmentId, input, event, current);
    if (previous) return previous;
    return writeTransition(transaction, uid, input.enrollmentId, input, input.action, { teamId: current.teamId,
      teamInstanceId: current.teamInstanceId, teamCreatedAt: current.teamCreatedAt, clubId: current.clubId,
      subjectKind: current.subjectKind, subjectId: current.subjectId, childCreatedAt: current.childCreatedAt, requesterUserId: current.requesterUserId }, current);
  });
}
