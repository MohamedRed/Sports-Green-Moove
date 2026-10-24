import { describe, expect, it } from "vitest";
import { toClientRideSnapshot } from "../lib/clientTrips.js";
import { nativeFallbackUpdateForAuth } from "../domain/locations.js";

const now = 1_760_000_000_000;
const snapshot = (vehicle: { capturedAt?: number; uploadedAt?: number }) =>
  toClientRideSnapshot("qa-ride", "active", { vehicle: { source: "nativeFallback", ...vehicle } }, null, now);

describe("location observation freshness", () => {
  it("keeps a two-minute-old position stale when it arrives just now", () => {
    expect(snapshot({ capturedAt: now - 120_000, uploadedAt: now })).toMatchObject({
      stale: true, vehicleLastUpdateLabel: "Secours GPS · il y a 2 min",
    });
  });
  it("cannot refresh an old position with a future client upload timestamp", () => {
    expect(snapshot({ capturedAt: now - 120_000, uploadedAt: now + 86_400_000 }).stale).toBe(true);
  });
  it("keeps the exact existing ninety-second freshness boundary", () => {
    expect(snapshot({ capturedAt: now - 90_000, uploadedAt: now }).stale).toBe(false);
    expect(snapshot({ capturedAt: now - 90_001, uploadedAt: now }).stale).toBe(true);
  });
  it("never calls a missing observation time fresh just because receipt time exists", () => {
    expect(snapshot({ uploadedAt: now })).toMatchObject({ stale: true, vehicleLastUpdateLabel: "Position à vérifier" });
  });
  it("does not label malformed observation times as just now", () => {
    for (const capturedAt of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(snapshot({ capturedAt, uploadedAt: now })).toMatchObject({ stale: true, vehicleLastUpdateLabel: "Position à vérifier" });
  });
  it("keeps future observations unverified rather than clamping their age to zero", () => {
    expect(snapshot({ capturedAt: now + 1, uploadedAt: now })).toMatchObject({ stale: true, vehicleLastUpdateLabel: "Position à vérifier" });
  });
  it("still shows a recently observed real timestamp as recent", () => {
    expect(snapshot({ capturedAt: now - 30_000, uploadedAt: now })).toMatchObject({
      stale: false, vehicleLastUpdateLabel: "Secours GPS · il y a 30 s",
    });
  });
  it("orders child observations by when they were captured, not when they arrived", () => {
    const ride = toClientRideSnapshot("qa-ride", "active", {
      vehicle: { capturedAt: now - 5_000, uploadedAt: now },
      children: {
        recent: { capturedAt: now - 30_000, uploadedAt: now - 20_000, source: "nativeFallback" },
        delayed: { capturedAt: now - 120_000, uploadedAt: now, source: "radar" },
      },
    }, null, now);
    expect(ride.childLastUpdateLabel).toBe("Secours GPS · il y a 30 s");
  });
  it("keeps the missing first-point state distinct from a malformed received point", () => {
    expect(toClientRideSnapshot("qa-ride", "active", null, null, now)).toMatchObject({
      stale: true, vehicleLastUpdateLabel: "En attente du premier point GPS", childLastUpdateLabel: null,
    });
  });
  it("sets native receipt time on the server instead of trusting an optional client value", () => {
    const update = nativeFallbackUpdateForAuth({ rideSessionId: "qa-ride", userId: "other", role: "driver",
      lat: 50.7, lng: 4.6, accuracyM: 8, capturedAt: now - 120_000, uploadedAt: now + 86_400_000, source: "manual" }, "qa-driver", now);
    expect(update).toMatchObject({ userId: "qa-driver", source: "nativeFallback", uploadedAt: now, capturedAt: now - 120_000 });
    expect(snapshot(update).stale).toBe(true);
  });
});
