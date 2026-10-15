import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";

const schema = z.object({ version: z.literal(1), kind: z.enum(["inbox", "bookings"]), userId: z.string().min(1),
  seconds: z.number().int().min(-62135596800).max(253402300799),
  nanos: z.number().int().min(0).max(999999999), id: chatDocumentIdSchema });
export type DirectoryKind = z.infer<typeof schema>["kind"];

export function directoryCursor(kind: DirectoryKind, userId: string, at: Timestamp, id: string): string {
  return Buffer.from(JSON.stringify({ version: 1, kind, userId, seconds: at.seconds, nanos: at.nanoseconds, id })).toString("base64url");
}

export function parseDirectoryCursor(encoded: string, kind: DirectoryKind, userId: string): [Timestamp, string] {
  let cursor: z.infer<typeof schema>;
  try {
    if (encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Malformed cursor");
    cursor = schema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch { throw new HttpsError("invalid-argument", "Invalid conversation page cursor."); }
  if (cursor.userId !== userId) throw new HttpsError("permission-denied", "Page cursor belongs to another user.");
  if (cursor.kind !== kind) throw new HttpsError("invalid-argument", "Page cursor belongs to a different list.");
  return [new Timestamp(cursor.seconds, cursor.nanos), cursor.id];
}
