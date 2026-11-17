import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";

export const tripChangeHistoryInput = z.object({ tripId: chatDocumentIdSchema,
  cursor: z.string().min(1).max(2048).optional() }).strict();
const cursorSchema = z.object({ version: z.literal(1), kind: z.literal("trip-change-history"),
  userId: z.string().min(1), tripId: chatDocumentIdSchema, id: z.string().regex(/^[a-f0-9]{64}$/),
  seconds: z.number().int().min(-62135596800).max(253402300799),
  nanos: z.number().int().min(0).max(999999999) }).strict();

export function tripHistoryCursor(userId: string, tripId: string, at: Timestamp, id: string): string {
  const value = cursorSchema.parse({ version: 1, kind: "trip-change-history", userId, tripId, id,
    seconds: at.seconds, nanos: at.nanoseconds });
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function parseTripHistoryCursor(encoded: string, userId: string, tripId: string): [Timestamp, string] {
  let cursor: z.infer<typeof cursorSchema>;
  try {
    if (encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Malformed cursor");
    cursor = cursorSchema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch { throw new HttpsError("invalid-argument", "Invalid trip history cursor."); }
  if (cursor.userId !== userId) throw new HttpsError("permission-denied", "Trip history cursor belongs to another user.");
  if (cursor.tripId !== tripId) throw new HttpsError("invalid-argument", "Trip history cursor belongs to another trip.");
  return [new Timestamp(cursor.seconds, cursor.nanos), cursor.id];
}
