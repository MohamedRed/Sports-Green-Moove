import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const membershipReviewSchema = z.object({
  userId: chatDocumentIdSchema, clubId: chatDocumentIdSchema,
  role: z.string().min(1), status: z.string().min(1), active: z.boolean().optional(),
});
export const reviewDecisionSchema = z.enum(["approve", "reject"]);
export type MembershipReviewRecord = z.infer<typeof membershipReviewSchema>;

export function isActiveClubManager(record: unknown, uid: string, clubId: string): boolean {
  const parsed = membershipReviewSchema.safeParse(record);
  return parsed.success && parsed.data.userId === uid && parsed.data.clubId === clubId &&
    parsed.data.role === "clubManager" && parsed.data.status === "active" && parsed.data.active !== false;
}

export function canReviewMembership(record: MembershipReviewRecord): boolean {
  return record.role === "member" && record.status === "requested" && record.active === false;
}

export function membershipVersion(at: Timestamp): string {
  return `${at.seconds}.${at.nanoseconds}`;
}
