import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { firestoreDocumentIdSchema } from "./firestoreDocumentId.js";
import { REPORT_STATUSES } from "./reports.js";

export const supportResponseSchema = z.object({
  reportId: firestoreDocumentIdSchema,
  requestId: z.string().uuid(),
  text: z.string().trim().min(1).max(2000),
  expectedStatus: z.enum(REPORT_STATUSES),
  expectedReplyCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  status: z.enum(["reviewing", "closed"]),
}).strict();
export type SupportResponseInput = z.infer<typeof supportResponseSchema>;

const replySchema = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().trim().min(1).max(2000),
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), sentAt: z.instanceof(Timestamp) });

export function publicSupportReply(id: string, data: Record<string, unknown>) {
  const parsed = replySchema.safeParse({ id, text: data.text, sequence: data.sequence, sentAt: data.sentAt });
  if (!parsed.success) throw new HttpsError("failed-precondition", "Support reply requires review.");
  const row = parsed.data;
  if (!Number.isSafeInteger(row.sentAt.toMillis()) || row.sentAt.toMillis() <= 0)
    throw new HttpsError("failed-precondition", "Support reply timestamp requires review.");
  return { id: row.id, text: row.text, sequence: row.sequence, sentAtMillis: row.sentAt.toMillis() };
}

export function publicSupportReport(id: string, data: Record<string, unknown>) {
  const parsed = z.object({ reason: z.string().min(2).max(120), description: z.string().min(5).max(2000),
    subjectType: z.enum(["booking", "rideSession", "message", "user", "other"]),
    reporterUserId: z.string().min(1), status: z.enum(REPORT_STATUSES), emergency: z.boolean().optional(),
    createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp).optional(),
    publicReplyCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  }).safeParse(data);
  if (!parsed.success) throw new HttpsError("failed-precondition", "Support report requires review.");
  const row = parsed.data, replyCount = row.publicReplyCount ?? 0;
  if (row.createdAt.toMillis() <= 0 || (row.updatedAt ?? row.createdAt).toMillis() < row.createdAt.toMillis())
    throw new HttpsError("failed-precondition", "Support report timestamp requires review.");
  let lastReply = null;
  if (replyCount > 0) {
    const reply = data.lastPublicReply;
    if (!reply || typeof reply !== "object" || Array.isArray(reply)) throw new HttpsError("failed-precondition", "Support reply is missing.");
    const stored = reply as Record<string, unknown>;
    lastReply = publicSupportReply(String(stored.id), stored);
    if (lastReply.sequence !== replyCount) throw new HttpsError("failed-precondition", "Support reply count requires review.");
  } else if (data.lastPublicReply != null) throw new HttpsError("failed-precondition", "Support reply count requires review.");
  return { id, reason: row.reason, description: row.description, emergency: row.emergency === true, status: row.status,
    createdAtMillis: row.createdAt.toMillis(), updatedAtMillis: (row.updatedAt ?? row.createdAt).toMillis(), replyCount, lastReply };
}

export function supportResponseIdentity(adminUid: string, input: SupportResponseInput) {
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  return { id: hash([adminUid, input.requestId]), digest: hash([input.reportId, input.text, input.expectedStatus, input.expectedReplyCount, input.status]) };
}
