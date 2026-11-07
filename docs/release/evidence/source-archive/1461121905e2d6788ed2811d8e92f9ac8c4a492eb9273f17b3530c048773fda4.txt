import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { compareTimes, digest, teamConversationTargetSchema } from "./teamConversation.js";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const teamConversationReadSchema = teamConversationTargetSchema.extend({
  expectedAccessVersion: hash,
  messageIds: z.array(hash).min(1).max(50).refine(ids => new Set(ids).size === ids.length, "Message IDs must be unique."),
}).strict();
export type TeamConversationRead = z.infer<typeof teamConversationReadSchema>;
export const teamReadReceiptId = (uid: string, messageId: string) => digest(["team-read-v1", uid, messageId]);

export function validateTeamReadReceipt(value: Record<string, unknown>, uid: string, messageId: string, createdAt: Timestamp) {
  if (value.userId !== uid || value.messageId !== messageId || !(value.messageCreatedAt instanceof Timestamp) ||
      compareTimes(value.messageCreatedAt, createdAt) !== 0 || !(value.readAt instanceof Timestamp) || compareTimes(value.readAt, createdAt) < 0)
    throw new HttpsError("failed-precondition", "Team message read metadata requires review.");
}
export function teamUnreadCount(incoming: number, acknowledged: number): number {
  if (!Number.isSafeInteger(incoming) || !Number.isSafeInteger(acknowledged) || acknowledged < 0 || incoming < acknowledged)
    throw new HttpsError("failed-precondition", "Team conversation unread metadata requires review.");
  return incoming - acknowledged;
}
