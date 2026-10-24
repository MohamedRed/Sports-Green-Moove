import type { LocationUpdate } from "../domain/types.js";
import { liveLocationPayload } from "../domain/liveLocationPayload.js";
import { shouldReplaceLiveLocation } from "../domain/liveLocationOrder.js";
import { realtimeDb } from "./firebase.js";

export async function writeLiveLocation(update: LocationUpdate): Promise<boolean> {
  const path =
    update.role === "driver"
      ? `liveTrips/${update.rideSessionId}/vehicle`
      : `liveTrips/${update.rideSessionId}/children/${update.userId}`;
  const payload = liveLocationPayload(update);
  // A contended transaction may be reevaluated after a newer capture arrives.
  const result = await realtimeDb.ref(path).transaction((current: unknown) =>
    shouldReplaceLiveLocation(current, update, Date.now()) ? payload : undefined,
  undefined, false);
  return result.committed;
}
