import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationUpdate } from "../domain/types.js";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../lib/firebase.js", () => ({ realtimeDb: { ref: () => ({ transaction: mocks.transaction }) } }));
import { writeLiveLocation, writeLiveLocationOutcome } from "../lib/liveTrips.js";

const now = 1_792_424_000_000;
const update: LocationUpdate = { rideSessionId: "qa-ride", userId: "qa-driver", role: "driver", lat: 50.7,
  lng: 4.6, accuracyM: 8, capturedAt: now - 1000, uploadedAt: now, source: "nativeFallback" };
afterEach(() => { vi.restoreAllMocks(); mocks.transaction.mockReset(); });
function transaction(current: unknown, committed: boolean) {
  vi.spyOn(Date, "now").mockReturnValue(now);
  mocks.transaction.mockImplementation(async (decide) => { decide(current); return { committed }; });
}
describe("atomic live-location receipts", () => {
  it("reports an actual commit and preserves the boolean writer contract", async () => {
    transaction(null, true);
    expect(await writeLiveLocationOutcome(update)).toBe("written");
    expect(await writeLiveLocation(update)).toBe(true);
  });
  it.each([update.capturedAt, update.capturedAt + 1])("acknowledges a valid retained point at %s without inventing a commit", async (capturedAt) => {
    transaction({ capturedAt }, false);
    expect(await writeLiveLocationOutcome(update)).toBe("retained");
    expect(await writeLiveLocation(update)).toBe(false);
  });
  it.each([0, -1, 1.5, now + 1])("does not acknowledge invalid or future capture %s as a duplicate", async (capturedAt) => {
    transaction(update, false);
    expect(await writeLiveLocationOutcome({ ...update, capturedAt })).toBe("invalid");
  });
  it("reevaluates validity inside the contended transaction before acknowledging", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(now).mockReturnValueOnce(now - 2000);
    mocks.transaction.mockImplementation(async (decide) => {
      expect(decide(null)).toBeDefined();
      expect(decide(update)).toBeUndefined();
      return { committed: false };
    });
    expect(await writeLiveLocationOutcome(update)).toBe("invalid");
  });
  it("does not convert a database failure into an acknowledgement", async () => {
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));
    await expect(writeLiveLocationOutcome(update)).rejects.toThrow("database unavailable");
  });
});
