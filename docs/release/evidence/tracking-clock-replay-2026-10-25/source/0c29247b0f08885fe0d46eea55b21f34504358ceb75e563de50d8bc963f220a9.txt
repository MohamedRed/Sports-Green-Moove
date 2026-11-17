import { describe, expect, it } from "vitest";
import { canWriteLiveLocation } from "../domain/locationAccess.js";
import { parseLocationBatchRequest } from "../domain/locationBatch.js";
import { liveLocationPayload } from "../domain/liveLocationPayload.js";
import { nativeFallbackUpdateForAuth } from "../domain/locations.js";

describe("native location fallback", () => {
  it("binds fallback updates to the authenticated user", () => {
    const update = nativeFallbackUpdateForAuth(
      {
        rideSessionId: "ride-1",
        userId: "spoofed-user",
        role: "driver",
        lat: 50.715,
        lng: 4.612,
        accuracyM: 8,
        capturedAt: 1760000000000,
        source: "manual",
      },
      "driver-1",
      1760000005000,
    );

    expect(update).toMatchObject({
      rideSessionId: "ride-1",
      userId: "driver-1",
      role: "driver",
      source: "nativeFallback",
      uploadedAt: 1760000005000,
    });
  });

  it("accepts JSON-encoded location batches for Swift callable clients", () => {
    const data = parseLocationBatchRequest({
      updatesJson: JSON.stringify([
        {
          rideSessionId: "ride-1",
          role: "child",
          lat: 50.715,
          lng: 4.612,
          accuracyM: 8,
          capturedAt: 1760000000000,
        },
      ]),
    });

    expect(data.updates).toHaveLength(1);
    expect(data.updates[0]).toMatchObject({
      rideSessionId: "ride-1",
      role: "child",
      lat: 50.715,
      lng: 4.612,
    });
  });

  it("rejects invalid JSON-encoded location batches", () => {
    expect(() => parseLocationBatchRequest({ updatesJson: "not-json" })).toThrow();
  });
  it("retains native clock provenance without treating device wall time as capture time", () => {
    const point = { rideSessionId: "ride-1", role: "driver", lat: 50.715, lng: 4.612, accuracyM: 8,
      capturedAt: 1760000000000, deviceCapturedAt: 1760086400000, captureClock: "serverElapsedRealtime" };
    const parsed = parseLocationBatchRequest({ updates: [point] }).updates[0];
    const normalized = nativeFallbackUpdateForAuth(parsed, "driver-1", 1760000005000);
    expect(liveLocationPayload(normalized)).toMatchObject({ capturedAt: point.capturedAt,
      deviceCapturedAt: point.deviceCapturedAt, captureClock: point.captureClock, userId: "driver-1" });
    expect(parseLocationBatchRequest({ updatesJson: JSON.stringify([point]) }).updates[0]).toEqual(parsed);
    for (const deviceCapturedAt of [0, -1])
      expect(parseLocationBatchRequest({ updates: [{ ...point, deviceCapturedAt }] }).updates[0].deviceCapturedAt).toBe(deviceCapturedAt);
    for (const patch of [{ deviceCapturedAt: 1.5 }, { deviceCapturedAt: Number.MAX_SAFE_INTEGER + 1 },
      { captureClock: "caller-verified" }]) expect(() => parseLocationBatchRequest({ updates: [{ ...point, ...patch }] })).toThrow();
  });
  it("rejects out-of-range coordinates through both native and JSON batch forms", () => {
    const point = { rideSessionId: "ride-1", role: "driver", lat: 50.715, lng: 4.612, accuracyM: 8, capturedAt: 1760000000000 };
    for (const patch of [{ lat: 91 }, { lat: -91 }, { lng: 181 }, { lng: -181 }]) {
      const updates = [{ ...point, ...patch }];
      expect(() => parseLocationBatchRequest({ updates })).toThrow();
      expect(() => parseLocationBatchRequest({ updatesJson: JSON.stringify(updates) })).toThrow();
    }
    for (const [lat, lng] of [[0, 0], [90, 180], [-90, -180]])
      expect(parseLocationBatchRequest({ updates: [{ ...point, lat, lng }] }).updates[0]).toMatchObject({ lat, lng });
  });

  it("omits undefined optional fields before writing live trip locations", () => {
    const payload = liveLocationPayload({
      rideSessionId: "ride-1",
      userId: "driver-1",
      role: "driver",
      lat: 50.715,
      lng: 4.612,
      accuracyM: 8,
      speedMps: undefined,
      headingDeg: undefined,
      batteryPct: undefined,
      capturedAt: 1760000000000,
      uploadedAt: 1760000005000,
      source: "radar",
    });

    expect(payload).toMatchObject({
      rideSessionId: "ride-1",
      userId: "driver-1",
      source: "radar",
      uploadedAt: 1760000005000,
    });
    expect(payload).not.toHaveProperty("speedMps");
    expect(payload).not.toHaveProperty("headingDeg");
    expect(payload).not.toHaveProperty("batteryPct");
  });

  it("allows only active ride drivers and child participants to write live locations", () => {
    const ride = {
      driverUserId: "driver-1",
      participantUserIds: ["parent-1"],
      childUserIds: ["child-1"],
      status: "active",
    };

    expect(canWriteLiveLocation("driver-1", { role: "driver" }, ride)).toBe(true);
    expect(canWriteLiveLocation("driver-2", { role: "driver" }, ride)).toBe(false);
    expect(canWriteLiveLocation("child-1", { role: "child" }, ride)).toBe(true);
    expect(canWriteLiveLocation("parent-1", { role: "child" }, ride)).toBe(false);
    expect(canWriteLiveLocation("child-2", { role: "child" }, ride)).toBe(false);
    expect(canWriteLiveLocation("driver-1", { role: "driver" }, { ...ride, status: "completed" })).toBe(false);
  });
});
