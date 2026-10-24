import { FieldPath, Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { publicSupportReply, publicSupportReport, supportResponseIdentity, type SupportResponseInput } from "../domain/supportReports.js";
import { firestore } from "../lib/firebase.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";

function ownedReport(uid: string, snapshot: DocumentSnapshot) {
  if (!snapshot.exists || snapshot.get("reporterUserId") !== uid) throw new HttpsError("not-found", "Support report not found.");
  return publicSupportReport(snapshot.id, snapshot.data()!);
}

export async function listOwnedSupportReports(uid: string, cursor?: string) {
  return firestore.runTransaction(async transaction => {
    const scope = JSON.stringify([uid, "support-reports"]);
    let query = firestore.collection("reports").where("reporterUserId", "==", uid)
      .orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    if (cursor) {
      const snapshot = await transaction.get(firestore.collection("reports").doc(parseMembershipPageCursor(cursor, scope)));
      ownedReport(uid, snapshot); query = query.startAfter(snapshot);
    }
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20);
    return { items: scanned.map(snapshot => ownedReport(uid, snapshot)),
      nextCursor: page.size > 20 ? membershipPageCursor(scope, scanned.at(-1)!.id) : null };
  });
}

export async function readOwnedSupportReport(uid: string, reportId: string, cursor?: string) {
  return firestore.runTransaction(async transaction => {
    const ref = firestore.collection("reports").doc(reportId), report = ownedReport(uid, await transaction.get(ref));
    const scope = JSON.stringify([uid, "support-replies", reportId]);
    let query = ref.collection("publicReplies").orderBy("sequence", "desc");
    if (cursor) {
      const raw = parseMembershipPageCursor(cursor, scope), sequence = Number(raw);
      if (!Number.isSafeInteger(sequence) || sequence < 1 || String(sequence) !== raw)
        throw new HttpsError("invalid-argument", "Invalid support reply cursor.");
      query = query.startAfter(sequence);
    }
    const page = await transaction.get(query.limit(21)), scanned = page.docs.slice(0, 20);
    const items = scanned.map(snapshot => publicSupportReply(snapshot.id, snapshot.data()));
    if (items.some(reply => reply.sequence > report.replyCount) || items.some((reply, index) => index > 0 && items[index - 1]!.sequence !== reply.sequence + 1) ||
        (page.size <= 20 && items.length > 0 && items.at(-1)!.sequence !== 1))
      throw new HttpsError("failed-precondition", "Support reply history requires review.");
    if (!cursor && (report.replyCount === 0 ? items.length !== 0 : JSON.stringify(items[0]) !== JSON.stringify(report.lastReply)))
      throw new HttpsError("failed-precondition", "Support reply history requires review.");
    return { report, replies: { items, nextCursor: page.size > 20 ? membershipPageCursor(scope, String(items.at(-1)!.sequence)) : null } };
  });
}

export async function respondToSupportReport(adminUid: string, input: SupportResponseInput) {
  const identity = supportResponseIdentity(adminUid, input);
  const reportRef = firestore.collection("reports").doc(input.reportId);
  const replyRef = reportRef.collection("publicReplies").doc(identity.id);
  const operationRef = firestore.collection("supportReplyOperations").doc(identity.id);
  return firestore.runTransaction(async transaction => {
    const [reportSnap, operationSnap, replySnap] = await transaction.getAll(reportRef, operationRef, replyRef);
    if (!reportSnap.exists) throw new HttpsError("not-found", "Support report not found.");
    const report = publicSupportReport(reportSnap.id, reportSnap.data()!);
    if (operationSnap.exists) {
      const operation = operationSnap.data()!;
      if (operation.adminUid !== adminUid || operation.digest !== identity.digest || operation.reportId !== input.reportId)
        throw new HttpsError("already-exists", "This response identity was already used for another action.");
      if (!replySnap.exists) throw new HttpsError("failed-precondition", "The saved support response requires review.");
      const reply = publicSupportReply(replySnap.id, replySnap.data()!);
      if (reply.text !== input.text || reply.sequence !== operation.sequence || replySnap.get("authorUid") !== adminUid)
        throw new HttpsError("failed-precondition", "The saved support response requires review.");
      return { reportId: input.reportId, replyId: reply.id, reply, status: operation.status, reused: true };
    }
    if (replySnap.exists) throw new HttpsError("failed-precondition", "Support response identity requires review.");
    if (report.status !== input.expectedStatus || report.replyCount !== input.expectedReplyCount)
      throw new HttpsError("failed-precondition", "The report changed. Refresh before responding.");
    const sentAt = Timestamp.now(), sequence = report.replyCount + 1;
    if (!Number.isSafeInteger(sequence)) throw new HttpsError("failed-precondition", "Support response count requires review.");
    const lastPublicReply = { id: identity.id, text: input.text, sequence, sentAt };
    transaction.create(replyRef, { ...lastPublicReply, authorUid: adminUid, previousStatus: report.status, status: input.status });
    transaction.create(operationRef, { adminUid, reportId: input.reportId, digest: identity.digest,
      sequence, status: input.status, createdAt: sentAt });
    transaction.update(reportRef, { publicReplyCount: sequence, lastPublicReply, status: input.status,
      reviewedByUserId: adminUid, reviewedAt: sentAt, updatedAt: sentAt, closedAt: input.status === "closed" ? sentAt : null });
    return { reportId: input.reportId, replyId: identity.id, reply: publicSupportReply(identity.id, lastPublicReply), status: input.status, reused: false };
  });
}
