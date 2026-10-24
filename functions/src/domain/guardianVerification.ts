import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const guardianStatusSchema = z.enum(["requested", "verified", "refused", "revoked", "withdrawn"]);
export const guardianActionSchema = z.enum(["request", "withdraw", "verify", "refuse", "revoke"]);
export const guardianTransitionSchema = z.object({
  childId: chatDocumentIdSchema, parentUserId: chatDocumentIdSchema, clubId: chatDocumentIdSchema,
  action: guardianActionSchema, requestId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
}).strict();
export type GuardianTransition = z.infer<typeof guardianTransitionSchema>;
export type GuardianStatus = z.infer<typeof guardianStatusSchema>;

export const guardianVerificationSchema = z.object({
  childId: chatDocumentIdSchema, parentUserId: chatDocumentIdSchema, clubId: chatDocumentIdSchema,
  status: guardianStatusSchema, revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lastActorUserId: chatDocumentIdSchema,
  createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp),
});

export function guardianVerificationId(clubId: string, childId: string, parentUserId: string): string {
  return digest([clubId, childId, parentUserId]);
}
export function guardianOperationId(uid: string, requestId: string): string {
  return digest([uid, requestId]);
}
export function guardianOperationDigest(input: GuardianTransition): string {
  return digest([input.clubId, input.childId, input.parentUserId, input.action, input.expectedRevision]);
}
function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function guardianNextStatus(current: GuardianStatus | undefined, action: GuardianTransition["action"]): GuardianStatus | null {
  if (action === "request" && (current === undefined || ["refused", "revoked", "withdrawn"].includes(current))) return "requested";
  if (action === "withdraw" && (current === "requested" || current === "verified")) return "withdrawn";
  if (action === "verify" && current === "requested") return "verified";
  if (action === "refuse" && current === "requested") return "refused";
  if (action === "revoke" && current === "verified") return "revoked";
  return null;
}

export function isActiveGuardianClubMember(record: Record<string, unknown> | undefined, uid: string, clubId: string): boolean {
  return record?.userId === uid && record.clubId === clubId && record.status === "active" && record.active !== false;
}
