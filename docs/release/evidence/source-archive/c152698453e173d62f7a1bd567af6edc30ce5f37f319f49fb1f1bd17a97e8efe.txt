import { createHash } from "node:crypto";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const childAccountCodeSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const childAccountApprovalSchema = z.object({
  code: childAccountCodeSchema,
  childId: chatDocumentIdSchema,
  clubId: chatDocumentIdSchema,
  expectedChildInstanceId: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const childAccountRequestSchema = z.object({}).strict();
export const childAccountCodeHash = (code: string) => createHash("sha256").update(code).digest("hex");
export const childAccountCodeLifetimeMs = 10 * 60_000;
export const childAccountCodeCooldownMs = 60_000;
export type ChildAccountApproval = z.infer<typeof childAccountApprovalSchema>;
