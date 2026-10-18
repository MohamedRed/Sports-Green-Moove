import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { requestTeamEnrollmentSchema, teamEnrollmentTargetSchema, transitionTeamEnrollmentSchema } from "../domain/teamEnrollment.js";
import { requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { requestTeamEnrollmentRecord, transitionTeamEnrollmentRecord } from "../services/teamEnrollment.js";
import { clubTeamEnrollmentPage, teamEnrollmentView } from "../services/teamEnrollmentViews.js";

export const getTeamEnrollmentView = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(teamEnrollmentTargetSchema, request.data);
  return teamEnrollmentView(uid, request.auth?.token, input);
});
export const requestTeamEnrollment = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(requestTeamEnrollmentSchema, request.data);
  return requestTeamEnrollmentRecord(uid, request.auth?.token, input);
});
export const transitionTeamEnrollment = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(transitionTeamEnrollmentSchema, request.data);
  return transitionTeamEnrollmentRecord(uid, request.auth?.token, input);
});
export const listTeamEnrollments = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(z.object({ teamId: chatDocumentIdSchema,
    cursor: membershipCursorSchema.optional() }).strict(), request.data);
  return clubTeamEnrollmentPage(uid, request.auth?.token, input.teamId, input.cursor);
});
