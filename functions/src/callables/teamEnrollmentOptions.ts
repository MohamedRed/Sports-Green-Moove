import { onCall } from "firebase-functions/v2/https";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { teamEnrollmentOptions, teamEnrollmentOptionsSchema } from "../services/teamEnrollmentOptions.js";

export const listTeamEnrollmentOptions = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(teamEnrollmentOptionsSchema, request.data);
  return teamEnrollmentOptions(uid, request.auth?.token, input);
});
