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
export const childRideEmergencyReadSchema = z.object({ rideSessionId: chatDocumentIdSchema }).strict();
export const emergencyWriteSchema = emergencyReadSchema.extend({
  contact: personalContactSchema.nullable(),
  expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  requestId: z.uuid(),
  expectedChildInstanceId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().superRefine((input, context) => {
  if ((input.target.kind === "child") !== (input.expectedChildInstanceId !== undefined))
    context.addIssue({ code: "custom", path: ["expectedChildInstanceId"], message: "The write must bind its exact child identity, or omit it for self." });
});
export type EmergencyTarget = z.infer<typeof emergencyTargetSchema>;
export type EmergencyWrite = z.infer<typeof emergencyWriteSchema>;
export const emergencyContactRecordSchema = z.object({
  kind: z.enum(["self", "child"]), subjectId: chatDocumentIdSchema,
  contact: personalContactSchema.nullable(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lastActorUserId: chatDocumentIdSchema, createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp),
  childInstanceId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  guardianClubId: chatDocumentIdSchema.optional(),
}).strict().refine((record) => (record.kind === "child") === (record.childInstanceId !== undefined) &&
  (record.kind === "child" || record.guardianClubId === undefined));
export const emergencyDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function emergencyChildInstanceId(childId: string, createdAt: Timestamp) {
  return emergencyDigest([childId, createdAt.seconds, createdAt.nanoseconds]);
}
export function emergencyContactId(kind: EmergencyTarget["kind"], subjectId: string, childInstanceId?: string) {
  if (kind === "self") {
    if (childInstanceId !== undefined) throw new Error("A self contact cannot bind a child identity.");
    return emergencyDigest([kind, subjectId]);
  }
  if (!childInstanceId || !/^[a-f0-9]{64}$/.test(childInstanceId)) throw new Error("An immutable child identity is required.");
  return emergencyDigest([kind, subjectId, childInstanceId]);
}
export const legacyChildEmergencyContactId = (childId: string) => emergencyDigest(["child", childId]);
export const emergencyOperationId = (uid: string, requestId: string) => emergencyDigest([uid, requestId]);
