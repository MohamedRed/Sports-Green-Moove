import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {hasValidLocationCapture, shouldReplaceLiveLocation} from "../domain/liveLocationOrder.js";
import type {LocationUpdate} from "../domain/types.js";

const evidence = JSON.parse(readFileSync(new URL("../../../docs/release/evidence/tracking-phone-clock-2026-10-25/clock-diagnostic.json", import.meta.url), "utf8")) as {
  records: Array<{serverNow: number; capturedAt: number; captureValid: boolean; futureDeltaMs: number}>;
};
const update = (capturedAt: number): LocationUpdate => ({rideSessionId: "clock-reproducer", userId: "synthetic-driver",
  role: "driver", lat: 50.7177, lng: 4.6177, accuracyM: 1, source: "nativeFallback", capturedAt});

describe("recorded phone timestamp rejection with synthetic coordinates", () => {
  it("reproduces every recorded clock-validity outcome without changing the safety rule", () => {
    expect(evidence.records).toHaveLength(48);
    for (const row of evidence.records) expect(hasValidLocationCapture(update(row.capturedAt), row.serverNow)).toBe(row.captureValid);
  });
  it("does not let an ahead-of-server capture poison the previously accepted point", () => {
    const accepted = evidence.records.find(row => row.captureValid)!;
    const future = evidence.records.filter(row => !row.captureValid);
    expect(future).toHaveLength(47);
    for (const row of future) {
      expect(row.futureDeltaMs).toBeGreaterThanOrEqual(1463);
      expect(shouldReplaceLiveLocation(update(accepted.capturedAt), update(row.capturedAt), row.serverNow)).toBe(false);
    }
  });
  it("does not trust native clock provenance as permission to accept a future primary capture", () => {
    for (const row of evidence.records.filter(record => !record.captureValid)) {
      expect(hasValidLocationCapture({...update(row.capturedAt), deviceCapturedAt: row.capturedAt,
        captureClock: "serverElapsedRealtime"}, row.serverNow)).toBe(false);
    }
  });
});
