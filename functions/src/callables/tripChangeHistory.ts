import { onCall } from "firebase-functions/v2/https";
import { tripChangeHistoryInput } from "../domain/tripChangeHistory.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { listTripChangeHistory } from "../services/tripChangeHistory.js";

export const getTripChangeHistory = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(tripChangeHistoryInput, request.data);
  return listTripChangeHistory(data.tripId, uid, data.cursor);
});
