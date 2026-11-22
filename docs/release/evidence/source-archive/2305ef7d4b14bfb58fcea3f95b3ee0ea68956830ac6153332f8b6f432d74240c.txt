import { onCall } from "firebase-functions/v2/https";
import { teamPushRegistrationSchema } from "../domain/teamPushRegistration.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { registerTeamPushInstallation } from "../services/teamPushRegistration.js";

export const registerTeamPushDevice = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  return registerTeamPushInstallation(uid, request.auth?.token, parseCallableData(teamPushRegistrationSchema, request.data));
});
