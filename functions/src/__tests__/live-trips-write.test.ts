import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationUpdate } from "../domain/types.js";

const { ref } = vi.hoisted(() => ({ ref: vi.fn() }));
vi.mock("../lib/firebase.js", () => ({ realtimeDb: { ref } }));
import { writeLiveLocation } from "../lib/liveTrips.js";

const now = 1_792_424_000_000;
const point: LocationUpdate = { rideSessionId: "qa-ride", userId: "qa-driver", role: "driver",
  lat: 50.715, lng: 4.612, accuracyM: 8, capturedAt: now - 10, uploadedAt: now, source: "nativeFallback" };
afterEach(() => { vi.restoreAllMocks(); ref.mockReset(); });

describe("atomic live location writer", () => {
  it("rechecks time on transaction reevaluation so a later valid capture cannot appear future", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(now).mockReturnValue(now + 20);
    ref.mockReturnValue({ transaction: async (update: (current: unknown) => unknown, _completion: unknown, local: boolean) => {
      expect(local).toBe(false);
      expect(update(null)).toMatchObject(point);
      expect(update({ ...point, capturedAt: now + 10 })).toBeUndefined();
      return { committed: false };
    } });
    expect(await writeLiveLocation(point)).toBe(false);
    expect(ref).toHaveBeenCalledWith("liveTrips/qa-ride/vehicle");
  });
  it("propagates a child register commit result", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    ref.mockReturnValue({ transaction: async (update: (current: unknown) => unknown) => {
      expect(update(null)).toMatchObject({ role: "child", userId: "qa-child" });
      return { committed: true };
    } });
    expect(await writeLiveLocation({ ...point, role: "child", userId: "qa-child" })).toBe(true);
    expect(ref).toHaveBeenCalledWith("liveTrips/qa-ride/children/qa-child");
  });
  it("does not manufacture success when the transaction fails", async () => {
    ref.mockReturnValue({ transaction: async () => { throw Error("transaction unavailable"); } });
    await expect(writeLiveLocation(point)).rejects.toThrow("transaction unavailable");
  });
});
