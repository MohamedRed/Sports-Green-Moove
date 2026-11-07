import { createHash } from "node:crypto";
import { z } from "zod";

export const supportSubmissionSchema = z.object({
  clientRequestId: z.uuid().transform(value => value.toLowerCase()),
  requesterUserId: z.string().min(1).max(128),
  subjectType: z.enum(["booking", "rideSession", "message", "user", "other"]),
  subjectId: z.string().trim().min(1).max(1500).optional(),
  reason: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  emergency: z.boolean().default(false),
}).strict();
export type SupportSubmission = z.infer<typeof supportSubmissionSchema>;
export function supportSubmissionIdentity(uid: string, input: SupportSubmission) {
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const content = { subjectType: input.subjectType, subjectId: input.subjectId ?? null,
    reason: input.reason, description: input.description, emergency: input.emergency };
  return { id: hash(["support-submission", uid, input.clientRequestId]), digest: hash(content), content };
}
