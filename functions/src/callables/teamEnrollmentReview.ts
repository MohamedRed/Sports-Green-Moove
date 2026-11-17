import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { teamEnrollmentReviewTeams } from "../services/teamEnrollmentReview.js";

const inputSchema = z.object({ clubId: chatDocumentIdSchema, cursor: membershipCursorSchema.optional() }).strict();
export const listTeamEnrollmentReviewTeams = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(inputSchema, request.data);
  return teamEnrollmentReviewTeams(uid, request.auth?.token, input.clubId, input.cursor);
});
