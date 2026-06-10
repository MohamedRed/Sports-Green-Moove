import type { RouteComparisonProvider } from "../domain/matching.js";
import type { LatLng, RouteComparison, SearchRequest, Trip } from "../domain/types.js";

function haversineMeters(a: LatLng, b: LatLng): number {
  const radiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * radiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export class GoogleRoutesProvider implements RouteComparisonProvider {
  constructor(private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY) {}

  async compareDetour(request: SearchRequest, trip: Trip): Promise<RouteComparison> {
    if (!this.apiKey) return this.localEstimate(request, trip);

    // The production implementation should call Google Routes Compute Route Matrix
    // for candidate comparison, then Compute Routes for the final shortlisted route.
    return this.localEstimate(request, trip);
  }

  private localEstimate(request: SearchRequest, trip: Trip): RouteComparison {
    const baselineDistanceMeters = haversineMeters(trip.origin, trip.destination) * 1.25;
    const driverToPickup = haversineMeters(trip.origin, request.origin) * 1.25;
    const pickupToDropoff = haversineMeters(request.origin, request.destination) * 1.25;
    const dropoffToDestination = haversineMeters(request.destination, trip.destination) * 1.25;
    const sharedDistance = driverToPickup + pickupToDropoff + dropoffToDestination;

    const detourDistanceMeters = Math.max(0, sharedDistance - baselineDistanceMeters);
    const averageMetersPerSecond = 9.8;
    const baselineDurationSeconds = baselineDistanceMeters / averageMetersPerSecond;
    const detourDurationSeconds = detourDistanceMeters / averageMetersPerSecond;
    const scheduleDeltaMinutes = Math.round(
      (new Date(trip.departureAt).getTime() - new Date(request.desiredDepartureAt).getTime()) / 60000,
    );

    return {
      baselineDistanceMeters: Math.round(baselineDistanceMeters),
      baselineDurationSeconds: Math.round(baselineDurationSeconds),
      detourDistanceMeters: Math.round(detourDistanceMeters),
      detourDurationSeconds: Math.round(detourDurationSeconds),
      pickupDistanceMeters: Math.round(driverToPickup),
      scheduleDeltaMinutes,
    };
  }
}
