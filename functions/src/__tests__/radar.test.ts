import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizeRadarWebhookPayload,
  radarEventToLocationUpdate,
  radarEventToRideSignal,
  verifyRadarSignature,
} from "../services/radar.js";

describe("Radar webhooks", () => {
  it("verifies HMAC-SHA1 signatures from the signing id header", () => {
    const signature = createHmac("sha1", "radar-secret").update("signing-id-1").digest("hex");

    expect(verifyRadarSignature("signing-id-1", signature, "radar-secret")).toBe(true);
    expect(verifyRadarSignature("signing-id-2", signature, "radar-secret")).toBe(false);
  });

  it("normalizes single and multi-event payloads", () => {
    expect(normalizeRadarWebhookPayload({
      event: { type: "user.started_trip" },
      user: { userId: "driver-1" },
    })).toHaveLength(1);

    expect(normalizeRadarWebhookPayload({
      events: [{ type: "user.started_trip" }, { type: "user.arrived_at_trip_destination" }],
      user: { userId: "driver-1" },
    })).toHaveLength(2);
  });

  it("maps Radar locations to live trip updates", () => {
    const update = radarEventToLocationUpdate({
      event: {
        type: "user.updated_trip",
        createdAt: "2026-06-12T12:00:00.000Z",
        trip: { externalId: "ride-1" },
        location: {
          latitude: 50.715,
          longitude: 4.612,
          accuracy: 8,
          speed: 5,
          heading: 90,
        },
      },
      user: { userId: "driver-1" },
    });

    expect(update).toMatchObject({
      rideSessionId: "ride-1",
      userId: "driver-1",
      role: "driver",
      lat: 50.715,
      lng: 4.612,
      accuracyM: 8,
      source: "radar",
    });
  });

  it("maps trip arrival and metadata actions to ride audit signals", () => {
    expect(radarEventToRideSignal({
      event: {
        _id: "evt_1",
        type: "user.arrived_at_trip_destination",
        createdAt: "2026-06-12T12:00:00.000Z",
        trip: { externalId: "ride-1", status: "arrived", eta: { duration: 60, distance: 300 } },
      },
      user: { userId: "driver-1" },
    })).toMatchObject({
      rideSessionId: "ride-1",
      eventId: "evt_1",
      action: "arrived",
      radarStatus: "arrived",
      etaSeconds: 60,
      etaDistanceMeters: 300,
    });

    expect(radarEventToRideSignal({
      event: {
        type: "user.entered_geofence",
        trip: { externalId: "ride-1", metadata: { sgmAction: "pickup" } },
      },
      user: { userId: "driver-1" },
    })?.action).toBe("pickup");
  });
});
