import type { LocationUpdate } from "../domain/types.js";
import { liveLocationPayload } from "../domain/liveLocationPayload.js";
import { hasValidLocationCapture, shouldReplaceLiveLocation } from "../domain/liveLocationOrder.js";
import { realtimeDb } from "./firebase.js";

export async function writeLiveLocation(update: LocationUpdate): Promise<boolean> {
  return await writeLiveLocationOutcome(update) === "written";
}

export type LiveLocationOutcome = "written" | "retained" | "invalid";

export async function writeLiveLocationOutcome(update: LocationUpdate): Promise<LiveLocationOutcome> {
  const path =
    update.role === "driver"
      ? `liveTrips/${update.rideSessionId}/vehicle`
      : `liveTrips/${update.rideSessionId}/children/${update.userId}`;
  const payload = liveLocationPayload(update);
  // A contended transaction may be reevaluated after a newer capture arrives.
  let outcome: LiveLocationOutcome = "invalid";
  const result = await realtimeDb.ref(path).transaction((current: unknown) => {
    const now = Date.now();
    if (shouldReplaceLiveLocation(current, update, now)) return payload;
    outcome = hasValidLocationCapture(update, now) ? "retained" : "invalid";
    return undefined;
  },
  undefined, false);
  return result.committed ? "written" : outcome;
}
