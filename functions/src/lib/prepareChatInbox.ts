import { FieldPath, Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { indexHistoricalChatMessage, compareChatPosition, type ChatInboxEntry,
  type ChatSource, type IndexedChatMessage } from "../domain/chatInbox.js";
import { requireChatParticipant } from "./chatConversation.js";
import { chatHistoryQuery, chatInboxRef, checkedChatInbox } from "./chatInboxIndex.js";
import { firestore } from "./firestore.js";

function historicalMessage(doc: QueryDocumentSnapshot, source: ChatSource): IndexedChatMessage {
  const value = doc.data();
  if (value.sourceType !== source.sourceType || value.sourceId !== source.sourceId ||
      typeof value.body !== "string" || !value.body.trim() || value.body.length > 1000 ||
      typeof value.senderUserId !== "string" || !value.senderUserId || !(value.createdAt instanceof Timestamp) ||
      !Array.isArray(value.participantUserIds) || value.participantUserIds.length === 0 ||
      value.participantUserIds.some((id: unknown) => typeof id !== "string" || !id) ||
      !value.participantUserIds.includes(value.senderUserId) ||
      (value.readByUserIds !== undefined && (!Array.isArray(value.readByUserIds) ||
        value.readByUserIds.some((id: unknown) => typeof id !== "string" || !id)))) {
    throw new HttpsError("failed-precondition", `Malformed historical message: ${doc.id}`);
  }
  return { ...source, id: doc.id, body: value.body, senderUserId: value.senderUserId, createdAt: value.createdAt,
    participantUserIds: value.participantUserIds, readByUserIds: value.readByUserIds };
}

export async function prepareChatInbox(uid: string, source: ChatSource, apply: boolean) {
  await requireChatParticipant(uid, source);
  const base = chatHistoryQuery(uid, source);
  const ordered = base.orderBy("createdAt", "asc").orderBy(FieldPath.documentId(), "asc");
  let boundary: QueryDocumentSnapshot | undefined;
  let entry: ChatInboxEntry | null = null;
  let scanned = 0;
  for (;;) {
    const page = await (boundary ? ordered.startAfter(boundary) : ordered).limit(100).get();
    for (const document of page.docs) {
      const message = historicalMessage(document, source);
      entry = indexHistoricalChatMessage(entry, uid, source, message);
      scanned += 1;
    }
    if (page.size < 100) break;
    boundary = page.docs[page.size - 1];
  }
  const prepared = entry;
  return firestore.runTransaction(async (transaction) => {
    await requireChatParticipant(uid, source, transaction);
    const ref = chatInboxRef(uid, source);
    const current = await transaction.get(ref);
    const count = (await transaction.get(base.count())).data().count;
    const latest = await transaction.get(base.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc").limit(1));
    const last = latest.docs[0];
    if (count !== scanned || Boolean(last) !== Boolean(prepared) || (last && prepared &&
        compareChatPosition({ at: historicalMessage(last, source).createdAt, id: last.id },
          { at: prepared.lastMessageAt, id: prepared.lastMessageId }) !== 0)) {
      throw new HttpsError("aborted", "Conversation history changed during indexing. Quiesce writes and retry.");
    }
    if (current.exists) {
      const stored = checkedChatInbox(current.data() ?? {}, uid, source);
      if (!prepared || stored.unreadCount !== prepared.unreadCount || stored.lastMessageId !== prepared.lastMessageId ||
          !stored.lastMessageAt.isEqual(prepared.lastMessageAt) || stored.lastMessageBody !== prepared.lastMessageBody ||
          stored.lastSenderUserId !== prepared.lastSenderUserId) {
        throw new HttpsError("failed-precondition", "Existing conversation index does not match its history.");
      }
      return { status: "already-indexed", messageCount: scanned, unreadCount: stored.unreadCount };
    }
    if (prepared && apply) transaction.create(ref, prepared);
    return { status: prepared ? (apply ? "indexed" : "would-index") : "empty", messageCount: scanned,
      unreadCount: prepared?.unreadCount ?? 0 };
  });
}
