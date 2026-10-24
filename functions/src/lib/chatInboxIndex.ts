import { FieldValue, type DocumentReference, type Transaction, type WithFieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { appendChatInbox, chatInboxId, requireChatInbox, type ChatInboxEntry,
  type ChatSource, type IndexedChatMessage } from "../domain/chatInbox.js";
import { firestore } from "./firestore.js";

export const chatInboxRef = (uid: string, source: ChatSource) => firestore.collection("chatInboxes").doc(chatInboxId(uid, source));
export const chatHistoryQuery = (uid: string, source: ChatSource) => firestore.collection("messages")
  .where("participantUserIds", "array-contains", uid).where("sourceType", "==", source.sourceType)
  .where("sourceId", "==", source.sourceId);

export function checkedChatInbox(value: Record<string, unknown>, uid: string, source: ChatSource): ChatInboxEntry {
  try { return requireChatInbox(value, uid, source); }
  catch { throw new HttpsError("failed-precondition", "Conversation history index requires preparation or repair."); }
}

export async function inboxWritesForMessage(transaction: Transaction, message: IndexedChatMessage): Promise<{
  ref: DocumentReference; data: WithFieldValue<ChatInboxEntry>;
}[]> {
  const snapshots = await transaction.getAll(...message.participantUserIds.map((uid) => chatInboxRef(uid, message)));
  const writes = [];
  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const uid = message.participantUserIds[index];
    let existing: ChatInboxEntry | null = null;
    if (snapshot.exists) existing = checkedChatInbox(snapshot.data() ?? {}, uid, message);
    else {
      const historical = await transaction.get(chatHistoryQuery(uid, message).limit(1));
      if (!historical.empty) throw new HttpsError("failed-precondition", "Existing conversation history must be indexed before sending.");
    }
    // New writes use commit time; historical preparation preserves stored chronology.
    writes.push({ ref: snapshot.ref, data: { ...appendChatInbox(existing, uid, message), lastMessageAt: FieldValue.serverTimestamp() } });
  }
  return writes;
}
