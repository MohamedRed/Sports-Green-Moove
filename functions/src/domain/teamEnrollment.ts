import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const enrollmentStatusSchema = z.enum(["requested", "approved", "refused", "withdrawn", "revoked"]);
export const teamEnrollmentTargetSchema = z.object({ teamId: chatDocumentIdSchema, childId: chatDocumentIdSchema.optional() }).strict();
const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
export const requestTeamEnrollmentSchema = teamEnrollmentTargetSchema.extend({ expectedTeamInstanceId: z.string().regex(/^[a-f0-9]{64}$/),
  expectedEnrollmentId: z.string().regex(/^[a-f0-9]{64}$/), expectedRevision: revision, requestId: z.uuid() }).strict();
export const transitionTeamEnrollmentSchema = z.object({ enrollmentId: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["approve", "refuse", "revoke", "withdraw"]), expectedRevision: revision, requestId: z.uuid() }).strict();
export const teamEnrollmentRecordSchema = z.object({
  teamId: chatDocumentIdSchema, teamInstanceId: z.string().regex(/^[a-f0-9]{64}$/), teamCreatedAt: z.instanceof(Timestamp),
  clubId: chatDocumentIdSchema, subjectKind: z.enum(["member", "child"]), subjectId: chatDocumentIdSchema,
  childCreatedAt: z.instanceof(Timestamp).nullable(),
  requesterUserId: chatDocumentIdSchema, status: enrollmentStatusSchema,
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lastActorUserId: chatDocumentIdSchema,
  createdAt: z.instanceof(Timestamp), updatedAt: z.instanceof(Timestamp),
}).strict().refine((record) => record.subjectKind === "child" ? record.childCreatedAt !== null
  : record.requesterUserId === record.subjectId && record.childCreatedAt === null);
export type TeamEnrollmentRecord = z.infer<typeof teamEnrollmentRecordSchema>;
export type TeamEnrollmentTarget = z.infer<typeof teamEnrollmentTargetSchema>;
export type TeamEnrollmentRequest = z.infer<typeof requestTeamEnrollmentSchema>;
export type TeamEnrollmentTransition = z.infer<typeof transitionTeamEnrollmentSchema>;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const teamInstanceId = (teamId: string, clubId: string, createdAt: Timestamp) =>
  digest([teamId, clubId, createdAt.seconds, createdAt.nanoseconds]);
export const teamEnrollmentId = (instance: string, kind: TeamEnrollmentRecord["subjectKind"], subjectId: string, childCreatedAt: Timestamp | null) =>
  digest([instance, kind, subjectId, childCreatedAt ? [childCreatedAt.seconds, childCreatedAt.nanoseconds] : null]);
export const teamEnrollmentOperationId = (uid: string, requestId: string) => digest([uid, requestId]);
export const teamEnrollmentFingerprint = (input: TeamEnrollmentRequest | TeamEnrollmentTransition) => "teamId" in input
  ? digest(["request-v1", input.teamId, input.childId ?? null, input.expectedTeamInstanceId, input.expectedEnrollmentId, input.expectedRevision])
  : digest(["transition-v1", input.enrollmentId, input.action, input.expectedRevision]);
export function nextTeamEnrollmentStatus(current: TeamEnrollmentRecord["status"] | undefined, action: "request" | TeamEnrollmentTransition["action"]): TeamEnrollmentRecord["status"] | null {
  if (action === "request" && (current === undefined || ["refused", "withdrawn", "revoked"].includes(current))) return "requested";
  if (current === "requested" && action === "approve") return "approved";
  if (current === "requested" && action === "refuse") return "refused";
  if (current === "approved" && action === "revoke") return "revoked";
  if (["requested", "approved"].includes(current ?? "") && action === "withdraw") return "withdrawn";
  return null;
}
