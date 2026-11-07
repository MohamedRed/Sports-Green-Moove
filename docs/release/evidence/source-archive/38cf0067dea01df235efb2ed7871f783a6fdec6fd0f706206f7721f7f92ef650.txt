import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { guardianReviewClubs, guardianVerificationList } from "../services/guardianLists.js";

const pageInput = z.object({ cursor: z.string().min(1).max(2048).optional() }).strict();
export const listGuardianReviewClubs = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { cursor } = parseCallableData(pageInput, request.data);
  return guardianReviewClubs(uid, request.auth?.token, cursor);
});
export const listMyGuardianVerifications = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { cursor } = parseCallableData(pageInput, request.data);
  return guardianVerificationList(uid, request.auth?.token, undefined, cursor);
});
export const listClubGuardianVerifications = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const { clubId, cursor } = parseCallableData(pageInput.extend({ clubId: chatDocumentIdSchema }), request.data);
  return guardianVerificationList(uid, request.auth?.token, clubId, cursor);
});
