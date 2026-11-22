import { describe, expect, it } from "vitest";
import { shouldReplaceLiveLocation } from "../domain/liveLocationOrder.js";
import type { LocationUpdate } from "../domain/types.js";

const now = 1_792_424_000_000;
const point = (capturedAt: number, source: LocationUpdate["source"] = "nativeFallback"): LocationUpdate => ({
  rideSessionId: "qa-ride", userId: "qa-driver", role: "driver", lat: 50.715, lng: 4.612,
  accuracyM: 8, capturedAt, uploadedAt: now, source,
});

describe("live location observation ordering", () => {
  it("accepts a first valid point without inventing an observation time", () => {
    expect(shouldReplaceLiveLocation(null, point(now - 30_000), now)).toBe(true);
  });
  it("does not use a later upload to replace a newer captured point", () => {
    expect(shouldReplaceLiveLocation(point(now - 20_000), point(now - 120_000), now)).toBe(false);
  });
  it("retains the first accepted observation at an equal timestamp", () => {
    expect(shouldReplaceLiveLocation(point(now - 20_000), { ...point(now - 20_000), lng: 4.4 }, now)).toBe(false);
  });
  it.each(["radar", "nativeFallback", "manual"] as const)("orders %s by observation time, not provider preference", (source) => {
    expect(shouldReplaceLiveLocation(point(now - 20_000, "radar"), point(now - 10_000, source), now)).toBe(true);
    expect(shouldReplaceLiveLocation(point(now - 20_000), point(now - 30_000, source), now)).toBe(false);
  });
  it.each([0, -1, 1.5, NaN, Infinity, now + 1, Number.MAX_SAFE_INTEGER + 1])("does not accept invalid incoming time %s", (time) => {
    expect(shouldReplaceLiveLocation(null, point(time), now)).toBe(false);
    expect(shouldReplaceLiveLocation(point(now - 20_000), point(time), now)).toBe(false);
  });
  it.each([null, {}, [], "bad-record", { capturedAt: now + 1 }, { capturedAt: 1.5 }])("allows a valid point to replace an unverified record %s", (current) => {
    expect(shouldReplaceLiveLocation(current, point(now - 20_000), now)).toBe(true);
  });
  it("converges to the greatest capture time across different delivery orders", () => {
    for (const times of [[10, 2, 8, 5], [2, 5, 8, 10], [10, 8, 5, 2], [5, 2, 10, 8]]) {
      let current: LocationUpdate | null = null;
      for (const time of times) {
        const incoming = point(now - 100 + time);
        if (shouldReplaceLiveLocation(current, incoming, now)) current = incoming;
      }
      expect(current?.capturedAt).toBe(now - 90);
    }
  });
});
