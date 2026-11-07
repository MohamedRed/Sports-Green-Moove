import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

const safeName = z.string().trim().min(1).max(100).refine((value) =>
  !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value));
export const personalContactSchema = z.object({
  name: safeName,
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
}).strict();
export const emergencyTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self") }).strict(),
  z.object({ kind: z.literal("child"), childId: chatDocumentIdSchema, clubId: chatDocumentIdSchema }).strict(),
]);
export const emergencyReadSchema = z.object({ target: emergencyTargetSchema }).strict();
export const emergencyWriteSchema = emergencyReadSchema.extend({
  contact: personalContactSchema.nullable(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  requestId: z.uuid(),
}).strict();
export type EmergencyTarget = z.infer<typeof emergencyTargetSchema>;
export type EmergencyWrite = z.infer<typeof emergencyWriteSchema>;
export const emergencyContactRecordSchema = z.object({
  kind: z.enum(["self", "child"]), subjectId: chatDocumentIdSchema,
  contact: personalContactSchema.nullable(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lastActorUserId: chatDocumentIdSchema, createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp),
}).strict();
export const emergencyDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const emergencyContactId = (kind: EmergencyTarget["kind"], subjectId: string) => emergencyDigest([kind, subjectId]);
export const emergencyOperationId = (uid: string, requestId: string) => emergencyDigest([uid, requestId]);
