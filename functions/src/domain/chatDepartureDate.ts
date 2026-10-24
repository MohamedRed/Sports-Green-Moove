import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

const publishedDate = z.string().datetime({ offset: true });

export function chatDepartureDate(value: unknown): Date {
  // Published trips store ISO dates; historical imports can store Firestore timestamps.
  if (value instanceof Timestamp) return value.toDate();
  const parsed = publishedDate.safeParse(value);
  if (parsed.success) {
    const date = new Date(parsed.data);
    if (Number.isFinite(date.getTime())) return date;
  }
  throw new Error("Conversation trip date is unavailable.");
}
