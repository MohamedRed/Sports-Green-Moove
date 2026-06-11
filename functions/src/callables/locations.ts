import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import type { LocationUpdate } from "../domain/types.js";
import { realtimeDb } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

const locationUpdateSchema = z.object({
  rideSessionId: z.string(),
  userId: z.string(),
  role: z.enum(["driver", "child"]),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nonnegative(),
  speedMps: z.number().optional(),
  headingDeg: z.number().optional(),
  batteryPct: z.number().optional(),
  capturedAt: z.number(),
  uploadedAt: z.number().optional(),
  source: z.enum(["radar", "nativeFallback", "manual"]),
});

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

export const writeLocationBatch = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    updates: z.array(locationUpdateSchema).min(1).max(100),
  });
  const data = schema.parse(request.data);

  for (const update of data.updates) {
    await writeLiveLocation({
      ...update,
      userId: update.userId || uid,
      uploadedAt: update.uploadedAt ?? Date.now(),
      source: "nativeFallback",
    });
  }

  return { written: data.updates.length };
});
