import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import type { ChatReference } from "./chatReference.js";

export type ChatSource = ChatReference;
export type IndexedChatMessage = ChatSource & {
  id: string; senderUserId: string; body: string; createdAt: Timestamp;
  participantUserIds: string[]; readByUserIds?: string[];
};
export type ChatInboxEntry = ChatSource & {
  schemaVersion: 1; userId: string; revision: number; unreadCount: number;
  lastMessageId: string; lastMessageAt: Timestamp; lastMessageBody: string; lastSenderUserId: string;
};

export function chatInboxId(userId: string, source: ChatSource): string {
  return createHash("sha256").update(JSON.stringify([userId, source.sourceType, source.sourceId])).digest("hex");
}

export function compareChatPosition(a: { at: Timestamp; id: string }, b: { at: Timestamp; id: string }): number {
  return a.at.seconds - b.at.seconds || a.at.nanoseconds - b.at.nanoseconds || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function requireChatInbox(value: Record<string, unknown>, userId: string, source: ChatSource): ChatInboxEntry {
  if (value.schemaVersion !== 1 || value.userId !== userId || value.sourceType !== source.sourceType ||
      value.sourceId !== source.sourceId || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 ||
      !Number.isSafeInteger(value.unreadCount) || Number(value.unreadCount) < 0 ||
      !(value.lastMessageAt instanceof Timestamp) || typeof value.lastMessageId !== "string" || !value.lastMessageId ||
      typeof value.lastMessageBody !== "string" || !value.lastMessageBody.trim() ||
      typeof value.lastSenderUserId !== "string" || !value.lastSenderUserId) {
    throw new Error("Conversation index is missing or inconsistent.");
  }
  return value as ChatInboxEntry;
}

export function appendChatInbox(existing: ChatInboxEntry | null, userId: string, message: IndexedChatMessage): ChatInboxEntry {
  if (!message.id || !message.senderUserId || !message.body.trim() || !(message.createdAt instanceof Timestamp)) {
    throw new Error("Message cannot be indexed without valid identity, content and timestamp.");
  }
  if (!message.participantUserIds.includes(userId)) throw new Error("Message does not address this inbox owner.");
  if (existing) requireChatInbox(existing, userId, message);
  const source: ChatSource = { sourceType: message.sourceType, sourceId: message.sourceId };
  const unreadCount = (existing?.unreadCount ?? 0) + (message.senderUserId === userId ? 0 : 1);
  const revision = (existing?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(unreadCount) || !Number.isSafeInteger(revision)) throw new Error("Conversation index limit exceeded.");
  return { ...source, schemaVersion: 1, userId, revision, unreadCount,
    lastMessageId: message.id, lastMessageAt: message.createdAt,
    lastMessageBody: message.body, lastSenderUserId: message.senderUserId };
}

export function acknowledgeChatInbox(entry: ChatInboxEntry, newlyReadIncoming: number): ChatInboxEntry {
  requireChatInbox(entry, entry.userId, entry);
  if (!Number.isSafeInteger(newlyReadIncoming) || newlyReadIncoming < 0 || newlyReadIncoming > entry.unreadCount) {
    throw new Error("Conversation unread count does not match its messages.");
  }
  const revision = entry.revision + (newlyReadIncoming > 0 ? 1 : 0);
  if (!Number.isSafeInteger(revision)) throw new Error("Conversation index limit exceeded.");
  return { ...entry, unreadCount: entry.unreadCount - newlyReadIncoming, revision };
}

export function indexHistoricalChatMessage(existing: ChatInboxEntry | null, userId: string,
  source: ChatSource, message: IndexedChatMessage): ChatInboxEntry {
  if (message.sourceType !== source.sourceType || message.sourceId !== source.sourceId ||
      !message.participantUserIds.includes(userId)) throw new Error("History does not belong to this inbox.");
  let next = appendChatInbox(existing, userId, message);
  if (existing && compareChatPosition({ at: message.createdAt, id: message.id },
    { at: existing.lastMessageAt, id: existing.lastMessageId }) <= 0) {
    next = { ...next, lastMessageAt: existing.lastMessageAt, lastMessageId: existing.lastMessageId,
      lastMessageBody: existing.lastMessageBody, lastSenderUserId: existing.lastSenderUserId };
  }
  return message.senderUserId !== userId && message.readByUserIds?.includes(userId) ? acknowledgeChatInbox(next, 1) : next;
}
