import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { ownedTeamEnrollmentPage, ownedTeamEnrollmentView } from "../services/teamEnrollmentHistory.js";

export const listOwnedTeamEnrollments = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ cursor: membershipCursorSchema.optional() }).strict(), request.data);
  return ownedTeamEnrollmentPage(uid, request.auth?.token, input.cursor);
});
export const getOwnedTeamEnrollmentView = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(z.object({ enrollmentId: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), request.data);
  return ownedTeamEnrollmentView(uid, request.auth?.token, input.enrollmentId);
});
