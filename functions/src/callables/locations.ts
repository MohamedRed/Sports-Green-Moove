import { HttpsError, onCall } from "firebase-functions/v2/https";
import { canWriteLiveLocation, type LocationAccessRideSession } from "../domain/locationAccess.js";
import { parseLocationBatchRequest } from "../domain/locationBatch.js";
import { nativeFallbackUpdateForAuth } from "../domain/locations.js";
import type { LocationUpdate } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireAuth } from "../lib/https.js";
import { writeLiveLocation } from "../lib/liveTrips.js";

export const writeLocationBatch = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseLocationBatchRequest(request.data);
  const updates: LocationUpdate[] = [];

  for (const update of data.updates) {
    if (!hasRole(request.auth?.token, update.role)) {
      throw new HttpsError("permission-denied", `${update.role} role is required.`);
    }
    updates.push(nativeFallbackUpdateForAuth(update, uid));
  }

  const rides = await loadRideSessions([...new Set(updates.map((update) => update.rideSessionId))]);
  for (const update of updates) {
    const ride = rides.get(update.rideSessionId);
    if (!ride) {
      throw new HttpsError("not-found", `Ride session ${update.rideSessionId} not found.`);
    }
    if (!canWriteLiveLocation(uid, update, ride)) {
      throw new HttpsError("permission-denied", "Location updates are limited to the active ride driver or child device.");
    }
  }

  await Promise.all(updates.map((update) => writeLiveLocation(update)));
  return { written: updates.length };
});

async function loadRideSessions(rideSessionIds: string[]): Promise<Map<string, LocationAccessRideSession>> {
  const snapshots = await Promise.all(
    rideSessionIds.map((rideSessionId) => firestore.collection("rideSessions").doc(rideSessionId).get()),
  );
  const rides = new Map<string, LocationAccessRideSession>();
  for (const snapshot of snapshots) {
    if (snapshot.exists) rides.set(snapshot.id, snapshot.data() as LocationAccessRideSession);
  }
  return rides;
}
