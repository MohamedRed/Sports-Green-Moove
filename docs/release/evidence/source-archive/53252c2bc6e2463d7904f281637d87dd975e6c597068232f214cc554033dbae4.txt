import { onCall } from "firebase-functions/v2/https";
import { guardianTransitionSchema } from "../domain/guardianVerification.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { transitionGuardianVerificationRecord } from "../services/guardianVerification.js";

export const transitionGuardianVerification = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(guardianTransitionSchema, request.data);
  return transitionGuardianVerificationRecord(uid, request.auth?.token, input);
});
