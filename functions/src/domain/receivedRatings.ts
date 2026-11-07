import { z } from "zod";

export const receivedRatingsReadSchema = z.object({}).strict();
export type ReceivedRatingSummary = { userId: string; count: number; average: number | null };

export function receivedRatingSummary(userId: string, count: unknown, average: unknown): ReceivedRatingSummary {
  if (!userId || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 ||
    (count === 0 ? average !== null : typeof average !== "number" || !Number.isFinite(average) || average < 1 || average > 5)) {
    throw new Error("Invalid received rating aggregate.");
  }
  return { userId, count, average: average as number | null };
}
