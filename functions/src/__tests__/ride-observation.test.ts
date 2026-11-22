import { describe, expect, it } from "vitest";
import { toClientRideSnapshot } from "../lib/clientTrips.js";

const now = 1_792_424_000_000;
describe("structured ride observation ages", () => {
  it("exposes capture ages rather than relying on the client wall clock or receipt timestamps", () => {
    const ride = toClientRideSnapshot("qa-ride", "active", {
      vehicle: { capturedAt: now - 120_000, uploadedAt: now, source: "nativeFallback" },
      children: { "qa-child": { capturedAt: now - 30_000, uploadedAt: now, source: "radar" } },
    }, null, now);
    expect(ride.observation).toEqual({ vehicleAgeMs: 120_000, childAgeMs: 30_000,
      vehicleHasPoint: true, childHasPoint: true, vehicleSource: "nativeFallback", childSource: "radar" });
  });
  it("distinguishes an absent point from an unverified timestamp", () => {
    expect(toClientRideSnapshot("qa-ride", "active", null, null, now).observation).toMatchObject({
      vehicleHasPoint: false, vehicleAgeMs: null, childHasPoint: false, childAgeMs: null,
    });
    expect(toClientRideSnapshot("qa-ride", "active", { vehicle: { capturedAt: now + 1 } }, null, now).observation)
      .toMatchObject({ vehicleHasPoint: true, vehicleAgeMs: null });
  });
});
