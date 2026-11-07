import { createHash } from "node:crypto";

const identity = (parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export const chatMessageId = (senderUserId: string, clientMessageId: string): string => identity([senderUserId, clientMessageId]);
export const chatNotificationId = (messageId: string, recipientUserId: string): string => `chat_${identity([messageId, recipientUserId])}`;

export function sameChatRequest(
  existing: Record<string, unknown>,
  request: { senderUserId: string; sourceType: string; sourceId: string; body: string },
): boolean {
  return existing.senderUserId === request.senderUserId && existing.sourceType === request.sourceType &&
    existing.sourceId === request.sourceId && existing.body === request.body;
}
