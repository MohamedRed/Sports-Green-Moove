import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { firestoreDocumentIdSchema } from "../domain/firestoreDocumentId.js";
import { supportResponseSchema } from "../domain/supportReports.js";
import { requireAdmin, requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { listOwnedSupportReports, readOwnedSupportReport, respondToSupportReport } from "../services/supportReports.js";

export const listMySupportReports = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ cursor: membershipCursorSchema.optional() }).strict(), request.data);
  return listOwnedSupportReports(uid, input.cursor);
});
export const getMySupportReport = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ reportId: firestoreDocumentIdSchema, cursor: membershipCursorSchema.optional() }).strict(), request.data);
  return readOwnedSupportReport(uid, input.reportId, input.cursor);
});
export const respondToReport = onCall(async request => {
  const uid = requireAuth(request.auth?.uid); requireAdmin(request.auth?.token);
  return respondToSupportReport(uid, parseCallableData(supportResponseSchema, request.data));
});
