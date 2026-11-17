import { describe, expect, it } from "vitest";
import { vehicleMapPoint } from "../domain/vehicleMapPoint.js";
import { toClientRideSnapshot } from "../lib/clientTrips.js";
const now = 1_760_000_000_000;
const point = { rideSessionId: "ride", userId: "driver", role: "driver", lat: 50.716, lng: 4.612,
  capturedAt: now - 30_000, source: "nativeFallback" };
const map = (value: unknown, owner: string | undefined = "driver", status = "active") => vehicleMapPoint(value, "ride", owner, status, now);
describe("authorized vehicle map observations", () => {
  it("exports only position, capture time and source from the active ride driver", () => {
    expect(map({ ...point, uploadedAt: now, providerPrivateData: "omit" })).toEqual({
      lat: point.lat, lng: point.lng, capturedAt: point.capturedAt, source: point.source,
    });
  });
  it("preserves an old last-known point without inventing a fresh capture time", () => {
    expect(map({ ...point, capturedAt: now - 180_000 })?.capturedAt).toBe(now - 180_000);
  });
  it("accepts zero and geographic boundary coordinates without a fabricated route anchor", () => {
    for (const [lat, lng] of [[0, 0], [-90, -180], [90, 180]]) expect(map({ ...point, lat, lng })).toMatchObject({ lat, lng });
  });
  it("rejects a different ride, replaced driver, missing identity, child point or completed ride", () => {
    for (const patch of [{ rideSessionId: "other" }, { userId: "other" }, { role: "child" }, { userId: undefined }, { role: undefined }])
      expect(map({ ...point, ...patch })).toBeNull();
    expect(map(point, "new-driver")).toBeNull(); expect(map(point, undefined, "completed")).toBeNull();
    expect(vehicleMapPoint(point, "ride", undefined, "active", now)).toBeNull();
  });
  it("rejects malformed coordinates, invalid capture times and unrecognized sources", () => {
    for (const patch of [{ lat: 91 }, { lng: -181 }, { lat: NaN }, { lng: Infinity }, { lat: "50" },
      { capturedAt: now + 1 }, { capturedAt: 0 }, { capturedAt: 1.5 }, { capturedAt: "1" }, { source: "unknown" }])
      expect(map({ ...point, ...patch })).toBeNull();
    for (const value of [undefined, null, [], "point"]) expect(map(value)).toBeNull();
  });
  it("never places child coordinates in the client ride snapshot", () => {
    const snapshot = toClientRideSnapshot("ride", "active", { vehicle: point,
      children: { child: { ...point, role: "child", userId: "child", lat: 49, lng: 3 } } }, { driverUserId: "driver" }, now);
    expect(snapshot.vehiclePoint).toMatchObject({ lat: point.lat, lng: point.lng });
    expect(snapshot).not.toHaveProperty("children"); expect(snapshot).not.toHaveProperty("childPoint");
    expect(toClientRideSnapshot("ride", "completed", { vehicle: point }, { driverUserId: "driver" }, now).vehiclePoint).toBeNull();
  });
});
