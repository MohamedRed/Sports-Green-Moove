import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";
import { roleKeysFromToken } from "./roles.js";

export const teamConversationTargetSchema = z.object({ teamId: chatDocumentIdSchema,
  expectedTeamInstanceId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const sendTeamMessageSchema = teamConversationTargetSchema.extend({
  clientMessageId: z.uuid().transform(id => id.toLowerCase()), body: z.string().trim().min(1).max(1000),
});
export type TeamConversationTarget = z.infer<typeof teamConversationTargetSchema>;
export type SendTeamMessage = z.infer<typeof sendTeamMessageSchema>;
export const teamMessageOperationId = (uid: string, requestId: string) => digest([uid, requestId]);
export const teamMessageFingerprint = (input: SendTeamMessage) => digest([
  "team-message-v1", input.teamId, input.expectedTeamInstanceId, input.body,
]);
export function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function compareTimes(a: Timestamp, b: Timestamp): number {
  return a.seconds === b.seconds ? a.nanoseconds - b.nanoseconds : a.seconds - b.seconds;
}
export function latestAdmission(...times: unknown[]): Timestamp {
  if (!times.length || times.some(time => !(time instanceof Timestamp))) throw Error("Admission timestamps are required.");
  return (times as Timestamp[]).reduce((latest, time) => compareTimes(latest, time) >= 0 ? latest : time);
}
export function adultTeamChatAccount(token: unknown, profile: Record<string, unknown> | undefined): boolean {
  const claims = roleKeysFromToken(token), roles = profile?.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return false;
  const current = roles as Record<string, unknown>;
  return !claims.includes("child") && current.child !== true &&
    ["parent", "driver", "clubManager"].some(role => claims.includes(role as "parent" | "driver" | "clubManager") && current[role] === true);
}
export function earliestCurrentAdmission(times: Timestamp[]): Timestamp {
  if (!times.length) throw Error("An approved current team membership is required.");
  return times.reduce((first, time) => compareTimes(first, time) <= 0 ? first : time);
}
