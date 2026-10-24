import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { firestoreDocumentIdSchema, isWellFormedUtf8 } from "../domain/firestoreDocumentId.js";
// JSON escaping expands some valid document IDs and their scoped context.
export const MEMBERSHIP_CURSOR_MAX_LENGTH = 16_384;
export const membershipCursorSchema = z.string().min(1).max(MEMBERSHIP_CURSOR_MAX_LENGTH).regex(/^[A-Za-z0-9_-]+$/);
const schema = z.object({ version: z.literal(1), scope: z.string().min(1).max(4096).refine(isWellFormedUtf8), id: firestoreDocumentIdSchema }).strict();
export function membershipPageCursor(scope: string, id: string): string {
  const parsed = schema.safeParse({ version: 1, scope, id });
  if (!parsed.success) throw new HttpsError("failed-precondition", "The pagination identity requires review.");
  const encoded = Buffer.from(JSON.stringify(parsed.data)).toString("base64url");
  if (encoded.length > MEMBERSHIP_CURSOR_MAX_LENGTH) throw new HttpsError("failed-precondition", "The pagination context exceeds its supported size.");
  return encoded;
}
export function parseMembershipPageCursor(encoded: string, scope: string): string {
  let parsed: z.infer<typeof schema>;
  try {
    membershipCursorSchema.parse(encoded);
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded) throw new Error("Noncanonical cursor");
    parsed = schema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch { throw new HttpsError("invalid-argument", "Invalid membership cursor."); }
  if (parsed.scope !== scope) throw new HttpsError("permission-denied", "Cursor belongs to another list.");
  return parsed.id;
}
