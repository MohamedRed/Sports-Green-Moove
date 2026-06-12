import type { LocationUpdate } from "../domain/types.js";
import { realtimeDb } from "./firebase.js";

export async function writeLiveLocation(update: LocationUpdate): Promise<void> {
  const path =
    update.role === "driver"
      ? `liveTrips/${update.rideSessionId}/vehicle`
      : `liveTrips/${update.rideSessionId}/children/${update.userId}`;
  await realtimeDb.ref(path).set({
    ...update,
    uploadedAt: update.uploadedAt || Date.now(),
  });
}
