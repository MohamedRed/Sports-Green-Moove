import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { compareTimes, teamMessageFingerprint, teamMessageOperationId, type SendTeamMessage, type TeamConversationTarget } from "../domain/teamConversation.js";
import { firestore } from "../lib/firebase.js";
import { membershipPageCursor, parseMembershipPageCursor } from "../lib/membershipPageCursor.js";
import { requireTeamConversationAccess } from "./teamConversationAuthority.js";

export async function sendTeamConversationMessage(uid: string, token: unknown, input: SendTeamMessage) {
  return firestore.runTransaction(async transaction => {
    const access = await requireTeamConversationAccess(transaction, uid, token, input);
    const operationId = teamMessageOperationId(uid, input.clientMessageId);
    const root = firestore.collection("teamConversations").doc(access.teamInstanceId);
    const message = root.collection("entries").doc(operationId);
    const operation = firestore.collection("teamMessageOperations").doc(operationId);
    const [existing, event, conversation] = await transaction.getAll(message, operation, root);
    const fingerprint = teamMessageFingerprint(input);
    if (event.exists) {
      if (event.get("fingerprint") !== fingerprint || event.get("actorUserId") !== uid)
        throw new HttpsError("already-exists", "This message request identity has already been used.");
      if (!existing.exists || existing.get("senderUserId") !== uid || existing.get("body") !== input.body)
        throw new HttpsError("failed-precondition", "Stored message identity requires review.");
      const at = existing.get("createdAt");
      if (!(at instanceof Timestamp) || compareTimes(at, access.availableAfter) <= 0)
        throw new HttpsError("permission-denied", "The earlier message is outside the current membership history.");
      return { messageId: operationId, sequence: existing.get("sequence"), reused: true };
    }
    if (existing.exists) throw new HttpsError("failed-precondition", "Message operation metadata requires review.");
    const sequence = conversation.exists ? conversation.get("lastSequence") : 0;
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= Number.MAX_SAFE_INTEGER ||
        conversation.exists && (conversation.get("teamId") !== access.teamId || conversation.get("clubId") !== access.clubId))
      throw new HttpsError("failed-precondition", "Conversation metadata requires review.");
    const createdAt = FieldValue.serverTimestamp();
    transaction.create(message, { senderUserId: uid, body: input.body, sequence: sequence + 1, createdAt });
    transaction.create(operation, { actorUserId: uid, fingerprint, teamInstanceId: access.teamInstanceId, createdAt });
    transaction.set(root, { teamId: access.teamId, clubId: access.clubId, lastSequence: sequence + 1, updatedAt: createdAt });
    return { messageId: operationId, sequence: sequence + 1, reused: false };
  });
}

export async function teamConversationPage(uid: string, token: unknown, input: TeamConversationTarget, cursor?: string) {
  return firestore.runTransaction(async transaction => {
    const access = await requireTeamConversationAccess(transaction, uid, token, input);
    const scope = JSON.stringify([uid, "team-conversation", access.teamInstanceId, access.accessVersion]);
    let query = firestore.collection("teamConversations").doc(access.teamInstanceId).collection("entries")
      .where("createdAt", ">", access.availableAfter).orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    if (cursor) {
      const position = parseMembershipPageCursor(cursor, scope).match(/^(-?\d+)\.(\d{1,9}):([a-f0-9]{64})$/);
      if (!position) throw new HttpsError("invalid-argument", "Invalid team conversation page position.");
      let at;
      try { at = new Timestamp(Number(position[1]), Number(position[2])); }
      catch { throw new HttpsError("invalid-argument", "Invalid team conversation page time."); }
      query = query.startAfter(at, position[3]);
    }
    const page = await transaction.get(query.limit(51)), rows = page.docs.slice(0, 50);
    const items = rows.map(row => {
      const value = row.data();
      if (!(value.createdAt instanceof Timestamp) || typeof value.body !== "string" || typeof value.senderUserId !== "string" ||
          !Number.isSafeInteger(value.sequence) || value.sequence < 1 || compareTimes(value.createdAt, access.availableAfter) <= 0)
        throw new HttpsError("failed-precondition", "Conversation message metadata requires review.");
      return { id: row.id, senderUserId: value.senderUserId, body: value.body, sequence: value.sequence,
        createdAtSeconds: value.createdAt.seconds, createdAtNanos: value.createdAt.nanoseconds };
    });
    const last = rows.at(-1), at = last?.get("createdAt");
    return { teamId: access.teamId, teamInstanceId: access.teamInstanceId, currentUserId: uid, title: access.title,
      historyPolicy: "after-current-admission", items, nextCursor: page.size > 50 && last && at instanceof Timestamp
        ? membershipPageCursor(scope, `${at.seconds}.${at.nanoseconds}:${last.id}`) : null };
  });
}
