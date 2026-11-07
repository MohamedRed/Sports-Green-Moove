import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";

const schema = z.object({ version: z.literal(1), scope: z.string().min(1), id: chatDocumentIdSchema });
export function membershipPageCursor(scope: string, id: string): string {
  return Buffer.from(JSON.stringify({ version: 1, scope, id })).toString("base64url");
}
export function parseMembershipPageCursor(encoded: string, scope: string): string {
  let parsed: z.infer<typeof schema>;
  try {
    if (encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("Malformed cursor");
    parsed = schema.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch { throw new HttpsError("invalid-argument", "Invalid membership cursor."); }
  if (parsed.scope !== scope) throw new HttpsError("permission-denied", "Cursor belongs to another list.");
  return parsed.id;
}
