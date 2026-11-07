import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(), read: vi.fn(), write: vi.fn(), load: vi.fn(), now: 1_792_930_000_000,
}));
vi.mock("../lib/firebase.js", () => ({
  firestore: { collection: () => ({ doc: () => ({ get: mocks.load }) }) },
  realtimeDb: { ref: () => ({ get: mocks.read }) },
}));
vi.mock("../lib/activeRideLookup.js", () => ({ loadAccessibleActiveRide: mocks.lookup }));
vi.mock("../lib/liveTrips.js", () => ({ writeLiveLocationOutcome: mocks.write }));
import { getActiveRide } from "../callables/rides.js";
import { writeLocationBatch } from "../callables/locations.js";

const rideId = "clock-ride";
const ride = { driverUserId: "driver", childUserIds: ["child"], status: "active" };
const point = { rideSessionId: rideId, role: "driver", lat: 50.7, lng: 4.6,
  accuracyM: 8, capturedAt: 1_792_929_999_000 };
const read = (data: Record<string, unknown> = {}, uid: string | null = "driver") => getActiveRide.run({
  data, ...(uid ? { auth: { uid, token: { roleKeys: ["driver"] } } } : {}),
} as Parameters<typeof getActiveRide.run>[0]);
const write = (data: Record<string, unknown> = { updates: [point] }, uid: string | null = "driver", role = "driver") =>
  writeLocationBatch.run({ data, ...(uid ? { auth: { uid, token: { roleKeys: [role] } } } : {}),
  } as Parameters<typeof writeLocationBatch.run>[0]);

beforeEach(() => {
  vi.clearAllMocks(); mocks.now = 1_792_930_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => mocks.now);
  mocks.lookup.mockResolvedValue({ id: rideId, ride });
  mocks.read.mockResolvedValue({ val: () => ({}) });
  mocks.load.mockResolvedValue({ id: rideId, exists: true, data: () => ride });
  mocks.write.mockResolvedValue("written");
});
afterEach(() => vi.restoreAllMocks());

describe("authenticated location clock response", () => {
  it("samples the server clock after the selected authorized ride has been read", async () => {
    mocks.read.mockImplementation(async () => { mocks.now += 750; return { val: () => ({}) }; });
    const result = await read({ rideSessionId: rideId });
    expect(result.serverTimeMs).toBe(1_792_930_000_750);
    expect(result.ride?.rideSessionId).toBe(rideId);
    expect(result.ride?.status).toBe("Actif");
    expect(mocks.lookup).toHaveBeenCalledWith("driver", { roleKeys: ["driver"] }, rideId);
  });
  it("does not invent an active ride just to issue a clock reference", async () => {
    mocks.lookup.mockResolvedValue(null);
    expect(await read({ rideSessionId: rideId })).toEqual({ ride: null, serverTimeMs: mocks.now });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("does not bypass a rejected ride lookup", async () => {
    mocks.lookup.mockRejectedValue(new Error("Ride access revoked"));
    await expect(read({ rideSessionId: rideId })).rejects.toThrow("Ride access revoked");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["written", "retained", "invalid"])("returns a post-write clock without changing the %s receipt", async status => {
    mocks.write.mockImplementation(async () => { mocks.now += 1_500; return status; });
    const result = await write();
    expect(result).toEqual({ written: status === "written" ? 1 : 0, ignored: status === "written" ? 0 : 1,
      receipts: [{ status, rideSessionId: rideId, role: "driver", capturedAt: point.capturedAt }],
      serverTimeMs: 1_792_930_001_500 });
    expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({
      capturedAt: point.capturedAt, uploadedAt: 1_792_930_000_000, userId: "driver", source: "nativeFallback",
    }));
  });
  it("does not turn a failed location transaction into a successful clock acknowledgement", async () => {
    mocks.write.mockRejectedValue(new Error("Location transaction unavailable"));
    await expect(write()).rejects.toThrow("Location transaction unavailable");
  });
  it.each(["read", "write"])("requires authentication before issuing a %s clock response", async operation => {
    await expect(operation === "read" ? read({}, null) : write({ updates: [point] }, null))
      .rejects.toMatchObject({ code: "unauthenticated" });
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it("keeps location role and ride ownership checks before the writer", async () => {
    await expect(write({ updates: [point] }, "parent", "parent")).rejects.toMatchObject({ code: "permission-denied" });
    await expect(write({ updates: [point] }, "another-driver")).rejects.toMatchObject({ code: "permission-denied" });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it.each(["serverTimeMs", "clockOffsetMs"])("rejects a caller-supplied %s instead of treating it as server time", async field => {
    await expect(read({ rideSessionId: rideId, [field]: mocks.now })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(write({ updates: [point], [field]: mocks.now })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
});
