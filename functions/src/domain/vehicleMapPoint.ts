import type { LocationSource } from "./types.js";
import { hasGeographicCoordinates } from "./geographicPoint.js";

export type VehicleMapPoint = { lat: number; lng: number; capturedAt: number; source: LocationSource };

export function vehicleMapPoint(
  value: unknown, rideSessionId: string, driverUserId: string | undefined, status: string, now: number,
): VehicleMapPoint | null {
  if (status !== "active" || !driverUserId || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  if (point.rideSessionId !== rideSessionId || point.userId !== driverUserId || point.role !== "driver") return null;
  if (!hasGeographicCoordinates(point)) return null;
  if (typeof point.capturedAt !== "number" || !Number.isSafeInteger(point.capturedAt) ||
      point.capturedAt <= 0 || point.capturedAt > now) return null;
  if (point.source !== "radar" && point.source !== "nativeFallback" && point.source !== "manual") return null;
  return { lat: point.lat, lng: point.lng, capturedAt: point.capturedAt, source: point.source };
}
