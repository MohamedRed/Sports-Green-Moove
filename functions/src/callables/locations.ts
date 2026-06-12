import { HttpsError, onCall } from "firebase-functions/v2/https";
import { parseLocationBatchRequest } from "../domain/locationBatch.js";
import { nativeFallbackUpdateForAuth } from "../domain/locations.js";
import { hasRole, requireAuth } from "../lib/https.js";
import { writeLiveLocation } from "../lib/liveTrips.js";

export const writeLocationBatch = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseLocationBatchRequest(request.data);

  for (const update of data.updates) {
    if (!hasRole(request.auth?.token, update.role)) {
      throw new HttpsError("permission-denied", `${update.role} role is required.`);
    }
    await writeLiveLocation(nativeFallbackUpdateForAuth(update, uid));
  }

  return { written: data.updates.length };
});
