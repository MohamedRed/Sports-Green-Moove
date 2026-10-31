import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { guardianParentOptions, guardianParentView } from "../services/guardianParent.js";

export const listGuardianParentOptions = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ kind: z.enum(["children", "clubs"]), cursor: membershipCursorSchema.optional() }).strict(), request.data);
  return guardianParentOptions(uid, request.auth?.token, input.kind, input.cursor);
});
export const getMyGuardianVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ clubId: chatDocumentIdSchema, childId: chatDocumentIdSchema }).strict(), request.data);
  return guardianParentView(uid, request.auth?.token, input.clubId, input.childId);
});
