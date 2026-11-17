import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { supportSubmissionIdentity, type SupportSubmission } from "../domain/supportSubmission.js";
import { firestore } from "../lib/firebase.js";

export async function submitSupportReport(uid: string, input: SupportSubmission) {
  if (input.requesterUserId !== uid) throw new HttpsError("permission-denied", "The support account changed.");
  const identity = supportSubmissionIdentity(uid, input);
  const reportRef = firestore.collection("reports").doc(identity.id);
  const operationRef = firestore.collection("supportSubmissionOperations").doc(identity.id);
  return firestore.runTransaction(async transaction => {
    const [report, operation] = await transaction.getAll(reportRef, operationRef);
    if (operation.exists) {
      if (operation.get("requesterUserId") !== uid || operation.get("digest") !== identity.digest ||
          operation.get("clientRequestId") !== input.clientRequestId || operation.get("reportId") !== reportRef.id)
        throw new HttpsError("already-exists", "This support identity was used for another request.");
      if (!report.exists || report.get("reporterUserId") !== uid ||
          Object.entries(identity.content).some(([key, value]) => (report.get(key) ?? null) !== value))
        throw new HttpsError("failed-precondition", "The saved support request requires review.");
      return { reportId: reportRef.id, clientRequestId: input.clientRequestId, requesterUserId: uid, status: "open", reused: true };
    }
    if (report.exists) throw new HttpsError("failed-precondition", "Support identity requires review.");
    const createdAt = Timestamp.now();
    transaction.create(reportRef, { ...identity.content, reporterUserId: uid, status: "open",
      publicReplyCount: 0, lastPublicReply: null, createdAt, updatedAt: createdAt });
    transaction.create(operationRef, { requesterUserId: uid, clientRequestId: input.clientRequestId,
      reportId: reportRef.id, digest: identity.digest, createdAt });
    return { reportId: reportRef.id, clientRequestId: input.clientRequestId, requesterUserId: uid, status: "open", reused: false };
  });
}
