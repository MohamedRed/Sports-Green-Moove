import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const teamPushTokenSchema = z.string().min(32).max(4096).regex(/^[A-Za-z0-9_:.-]+$/);
export const teamPushRegistrationSchema = z.object({
  installationId: z.uuid().transform(value => value.toLowerCase()), installationSecret: hashSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
  platform: z.literal("android"), token: teamPushTokenSchema.nullable(),
}).strict();
export type TeamPushRegistration = z.infer<typeof teamPushRegistrationSchema>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const teamPushInstallationId = (id: string) => hash(["team-push-installation", id]);
export const teamPushSecretHash = (secret: string) => hash(["team-push-proof", secret]);
export const teamPushTokenId = (token: string) => hash(["team-push-token", token]);
export const teamPushRegistrationFingerprint = (uid: string, value: Pick<TeamPushRegistration, "platform" | "revision" | "token">) =>
  hash([uid, value.platform, value.revision, value.token]);
export const teamPushDeviceLimit = 20;
export const teamPushRegistrationRecordSchema = z.object({
  schemaVersion: z.literal(1), userId: chatDocumentIdSchema, platform: z.literal("android"),
  secretHash: hashSchema, revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
  fingerprint: hashSchema, active: z.boolean(), token: teamPushTokenSchema.nullable(),
  createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp),
}).strict().refine(value => value.active === (value.token !== null));
export const teamPushTokenOwnerSchema = z.object({
  installationId: hashSchema, userId: chatDocumentIdSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1),
}).strict();
