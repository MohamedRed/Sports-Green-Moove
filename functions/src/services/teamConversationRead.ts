import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { compareTimes } from "../domain/teamConversation.js";
import { teamReadReceiptId, teamUnreadCount, validateTeamReadReceipt, type TeamConversationRead } from "../domain/teamConversationRead.js";
import { firestore } from "../lib/firebase.js";
import { requireTeamConversationAccess } from "./teamConversationAuthority.js";

const conversation = (teamInstanceId: string) => firestore.collection("teamConversations").doc(teamInstanceId);

export async function currentTeamUnreadCount(transaction: Transaction, uid: string, teamInstanceId: string, availableAfter: Timestamp) {
  const root = conversation(teamInstanceId);
  const incoming = await transaction.get(root.collection("entries").where("createdAt", ">", availableAfter)
    .where("senderUserId", "!=", uid).orderBy("createdAt").orderBy("senderUserId").count());
  const read = await transaction.get(root.collection("readReceipts").where("userId", "==", uid)
    .where("messageCreatedAt", ">", availableAfter).count());
  return teamUnreadCount(incoming.data().count, read.data().count);
}

export async function markTeamConversationMessagesRead(uid: string, token: unknown, input: TeamConversationRead) {
  return firestore.runTransaction(async transaction => {
    const access = await requireTeamConversationAccess(transaction, uid, token, input);
    if (access.accessVersion !== input.expectedAccessVersion)
      throw new HttpsError("permission-denied", "Team conversation authority changed. Refresh before acknowledging reads.");
    const root = conversation(access.teamInstanceId);
    const entries = await transaction.getAll(...input.messageIds.map(id => root.collection("entries").doc(id)));
    const receipts = await transaction.getAll(...input.messageIds.map(id => root.collection("readReceipts").doc(teamReadReceiptId(uid, id))));
    for (const [index, entry] of entries.entries()) {
      if (!entry.exists) throw new HttpsError("not-found", "Team message not found.");
      const at = entry.get("createdAt"), sender = entry.get("senderUserId");
      if (!(at instanceof Timestamp) || typeof sender !== "string" || !sender || sender.includes("/"))
        throw new HttpsError("failed-precondition", "Team message identity requires review.");
      if (compareTimes(at, access.availableAfter) <= 0)
        throw new HttpsError("permission-denied", "The message is outside the current membership history.");
      if (receipts[index].exists) {
        if (sender === uid) throw new HttpsError("failed-precondition", "Own messages cannot have incoming read receipts.");
        validateTeamReadReceipt(receipts[index].data()!, uid, entry.id, at);
      }
    }
    for (const [index, entry] of entries.entries()) {
      if (entry.get("senderUserId") !== uid && !receipts[index].exists) transaction.create(receipts[index].ref, {
        userId: uid, messageId: entry.id, messageCreatedAt: entry.get("createdAt"), readAt: FieldValue.serverTimestamp(),
      });
    }
    return { currentUserId: uid, teamInstanceId: access.teamInstanceId, accessVersion: access.accessVersion,
      readMessageIds: input.messageIds };
  });
}

export async function teamMessageReadFlags(transaction: Transaction, uid: string, teamInstanceId: string,
  messages: { id: string; senderUserId: string; createdAtSeconds: number; createdAtNanos: number }[]) {
  if (!messages.length) return [];
  const receipts = await transaction.getAll(...messages.map(message =>
    conversation(teamInstanceId).collection("readReceipts").doc(teamReadReceiptId(uid, message.id))));
  return messages.map((message, index) => {
    const receipt = receipts[index];
    if (receipt.exists) {
      if (message.senderUserId === uid) throw new HttpsError("failed-precondition", "Own messages cannot have incoming read receipts.");
      validateTeamReadReceipt(receipt.data()!, uid, message.id, new Timestamp(message.createdAtSeconds, message.createdAtNanos));
    }
    return message.senderUserId !== uid && !receipt.exists;
  });
}
