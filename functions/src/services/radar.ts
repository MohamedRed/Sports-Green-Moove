import { createHmac, timingSafeEqual } from "node:crypto";
import type { LocationUpdate } from "../domain/types.js";

export type RadarWebhookEvent = {
  type: string;
  user?: {
    userId?: string;
  };
  trip?: {
    externalId?: string;
    status?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };
  createdAt?: string;
};

export function verifyRadarSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret = process.env.RADAR_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(digest);
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function radarEventToLocationUpdate(event: RadarWebhookEvent): LocationUpdate | null {
  if (!event.trip?.externalId || !event.user?.userId || !event.location?.latitude || !event.location?.longitude) {
    return null;
  }

  return {
    rideSessionId: event.trip.externalId,
    userId: event.user.userId,
    role: "driver",
    lat: event.location.latitude,
    lng: event.location.longitude,
    accuracyM: event.location.accuracy ?? 0,
    speedMps: event.location.speed,
    headingDeg: event.location.heading,
    capturedAt: event.createdAt ? Date.parse(event.createdAt) : Date.now(),
    uploadedAt: Date.now(),
    source: "radar",
  };
}
