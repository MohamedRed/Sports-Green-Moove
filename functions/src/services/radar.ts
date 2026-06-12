import { createHmac, timingSafeEqual } from "node:crypto";
import type { LocationUpdate } from "../domain/types.js";

export type RadarWebhookUser = {
  userId?: string;
  metadata?: Record<string, unknown>;
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };
};

export type RadarWebhookEvent = {
  _id?: string;
  type: string;
  user?: RadarWebhookUser;
  trip?: {
    externalId?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    eta?: {
      duration?: number;
      distance?: number;
    };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type RadarWebhookPayload = {
  event?: RadarWebhookEvent;
  events?: RadarWebhookEvent[];
  user?: RadarWebhookUser;
};

export type NormalizedRadarEvent = {
  event: RadarWebhookEvent;
  user?: RadarWebhookUser;
};

export type RadarRideSignal = {
  rideSessionId: string;
  eventId: string;
  eventType: string;
  capturedAt: number;
  userId?: string;
  radarStatus?: string;
  etaSeconds?: number;
  etaDistanceMeters?: number;
  action?: "started" | "approaching" | "arrived" | "stopped" | "pickup" | "dropoff";
};

export function verifyRadarSignature(
  signingId: string | undefined,
  signature: string | undefined,
  secret = process.env.RADAR_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature || !signingId) return false;
  const digest = createHmac("sha1", secret).update(signingId).digest("hex");
  const expected = Buffer.from(digest);
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function normalizeRadarWebhookPayload(payload: RadarWebhookPayload): NormalizedRadarEvent[] {
  if (Array.isArray(payload.events)) {
    return payload.events.map((event) => ({ event, user: event.user ?? payload.user }));
  }
  if (payload.event) return [{ event: payload.event, user: payload.event.user ?? payload.user }];
  return [];
}

export function radarEventToLocationUpdate(
  normalized: RadarWebhookEvent | NormalizedRadarEvent,
): LocationUpdate | null {
  const event = "event" in normalized ? normalized.event : normalized;
  const user = "event" in normalized ? normalized.user ?? event.user : event.user;
  const location = event.location ?? user?.location;
  const userId = event.user?.userId ?? user?.userId;
  if (!event.trip?.externalId || !userId || location?.latitude == null || location.longitude == null) {
    return null;
  }

  return {
    rideSessionId: event.trip.externalId,
    userId,
    role: radarRoleFromMetadata(event, user),
    lat: location.latitude,
    lng: location.longitude,
    accuracyM: location.accuracy ?? 0,
    speedMps: location.speed,
    headingDeg: location.heading,
    capturedAt: event.createdAt ? Date.parse(event.createdAt) : Date.now(),
    uploadedAt: Date.now(),
    source: "radar",
  };
}

export function radarEventToRideSignal(normalized: NormalizedRadarEvent): RadarRideSignal | null {
  const { event, user } = normalized;
  const rideSessionId = event.trip?.externalId ?? stringMetadata(event.metadata, "rideSessionId");
  if (!rideSessionId) return null;

  return {
    rideSessionId,
    eventId: radarEventId(event, user),
    eventType: event.type,
    capturedAt: event.createdAt ? Date.parse(event.createdAt) : Date.now(),
    userId: event.user?.userId ?? user?.userId,
    radarStatus: event.trip?.status,
    etaSeconds: event.trip?.eta?.duration,
    etaDistanceMeters: event.trip?.eta?.distance,
    action: radarAction(event),
  };
}

function radarRoleFromMetadata(event: RadarWebhookEvent, user?: RadarWebhookUser): "driver" | "child" {
  const role = stringMetadata(event.metadata, "role") ?? stringMetadata(event.trip?.metadata, "role") ?? stringMetadata(user?.metadata, "role");
  return role === "child" ? "child" : "driver";
}

function radarAction(event: RadarWebhookEvent): RadarRideSignal["action"] {
  const metadataAction = stringMetadata(event.metadata, "sgmAction") ?? stringMetadata(event.trip?.metadata, "sgmAction");
  if (metadataAction === "pickup" || metadataAction === "dropoff") return metadataAction;

  switch (event.type) {
    case "user.started_trip":
      return "started";
    case "user.approaching_trip_destination":
      return "approaching";
    case "user.arrived_at_trip_destination":
      return "arrived";
    case "user.stopped_trip":
      return "stopped";
    default:
      return undefined;
  }
}

function radarEventId(event: RadarWebhookEvent, user?: RadarWebhookUser): string {
  return (
    event._id ??
    `${event.type}_${event.createdAt ?? "unknown"}_${event.user?.userId ?? user?.userId ?? "anonymous"}`
  ).replace(/[^A-Za-z0-9._-]/g, "_");
}

function stringMetadata(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
