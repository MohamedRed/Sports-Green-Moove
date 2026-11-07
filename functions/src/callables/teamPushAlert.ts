import { onCall } from "firebase-functions/v2/https";
import { teamPushAlertRequestSchema } from "../domain/teamPushAlert.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { resolveCurrentTeamPushAlert } from "../services/teamPushAlert.js";

export const resolveTeamPushAlert = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  return resolveCurrentTeamPushAlert(uid, request.auth?.token, parseCallableData(teamPushAlertRequestSchema, request.data));
});
