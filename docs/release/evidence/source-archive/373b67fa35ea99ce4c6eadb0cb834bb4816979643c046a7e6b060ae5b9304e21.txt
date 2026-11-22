import { createHash, createHmac } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";
import config from "../config/childInvitation.json" with { type: "json" };

export const invitationSecretSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const childInvitationTargetSchema = z.object({
  childId: chatDocumentIdSchema, clubId: chatDocumentIdSchema,
  expectedChildInstanceId: invitationSecretSchema,
}).strict();
export const revokeChildInvitationSchema = childInvitationTargetSchema.extend({ invitationHash: invitationSecretSchema }).strict();
export const redeemChildInvitationSchema = z.object({
  token: invitationSecretSchema,
  email: z.email().trim().toLowerCase().max(254), password: z.string().min(12).max(128),
}).strict();
export type InvitationTarget = z.infer<typeof childInvitationTargetSchema>;
export type InvitationRedemption = z.infer<typeof redeemChildInvitationSchema>;
export const invitationHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const invitationOwnerId = (childId: string, instanceId: string) => invitationHash(JSON.stringify([childId, instanceId]));
export const invitationLifetimeMs = 24 * 60 * 60_000;
export const invitationCooldownMs = 60_000;
export function invitationUrl(token: string) {
  invitationSecretSchema.parse(token);
  const url = new URL(config.signupUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("Invalid child invitation origin configuration");
  url.hash = token;
  return url.href;
}
export function redemptionDigest(input: InvitationRedemption) {
  // The 256-bit link secret is never stored; this binds retries without retaining credentials or a guessable password hash.
  return createHmac("sha256", input.token).update(JSON.stringify([input.email, input.password])).digest("hex");
}
export const invitationRecordSchema = z.object({
  parentUserId: chatDocumentIdSchema, childId: chatDocumentIdSchema, clubId: chatDocumentIdSchema,
  childInstanceId: invitationSecretSchema, ownerId: invitationSecretSchema,
  createdAt: z.instanceof(Timestamp), expiresAt: z.instanceof(Timestamp),
  status: z.enum(["pending", "provisioning", "accepted", "revoked"]),
  accountUserId: chatDocumentIdSchema.optional(),
  requestDigest: invitationSecretSchema.optional(), email: z.email().optional(), childName: z.string().optional(),
  attemptWindowAt: z.instanceof(Timestamp).optional(), attemptCount: z.number().int().min(0).max(5).optional(),
  acceptedAt: z.instanceof(Timestamp).optional(), revokedAt: z.instanceof(Timestamp).optional(),
}).strict();
export type InvitationRecord = z.infer<typeof invitationRecordSchema>;
