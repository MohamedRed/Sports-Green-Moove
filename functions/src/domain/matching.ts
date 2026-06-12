import type { RankedTrip, RouteComparison, SearchRequest, Trip } from "./types.js";
import { hasCompatibleMembership, isWithinDepartureWindow, matchesRegion } from "./candidateFilters.js";

const baggageRank = {
  small: 1,
  medium: 2,
  large: 3,
};

export type RouteComparisonProvider = {
  compareDetour(request: SearchRequest, trip: Trip): Promise<RouteComparison>;
  completeRouteDetails?(request: SearchRequest, trip: Trip, route: RouteComparison): Promise<RouteComparison>;
};

export class RouteUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteUnavailableError";
  }
}

export function passesHardFilters(request: SearchRequest, trip: Trip): boolean {
  if (trip.status !== "published") return false;
  if (!trip.driverVerified) return false;
  if (!request.guardianConsent) return false;
  if (!isWithinDepartureWindow(request, trip)) return false;
  if (!matchesRegion(request, trip)) return false;
  if (!hasCompatibleMembership(request, trip)) return false;
  if (trip.seatsAvailable < request.seatsNeeded) return false;
  if (request.clubId && trip.clubId !== request.clubId) return false;
  if (request.category && trip.category !== request.category) return false;
  if (request.returnTrip && !trip.returnTrip) return false;
  if (baggageRank[trip.baggage] < baggageRank[request.baggage]) return false;
  if (request.requireChildTracking && !trip.supportsChildTracking) return false;
  if (trip.blockedUserIds?.includes(request.requesterUserId)) return false;
  return true;
}

export function scoreCandidate(request: SearchRequest, trip: Trip, route: RouteComparison): number {
  const detourMinutes = route.detourDurationSeconds / 60;
  const detourKm = route.detourDistanceMeters / 1000;
  const pickupKm = route.pickupDistanceMeters / 1000;

  let score = 100;
  score -= detourMinutes * 2.25;
  score -= detourKm * 1.1;
  score -= pickupKm * 5;
  score -= Math.abs(route.scheduleDeltaMinutes) * 1.4;

  if (request.clubId && request.clubId === trip.clubId) score += 14;
  if (request.teamId && request.teamId === trip.teamId) score += 18;
  if (trip.seatsAvailable > request.seatsNeeded) score += Math.min(8, trip.seatsAvailable * 2);
  if (trip.supportsVehicleTracking) score += 6;
  if (trip.supportsChildTracking) score += 8;

  score += Math.max(0, trip.driverRating - 3) * 5;
  score += Math.min(8, trip.co2SavedKgEstimate);
  score -= Math.min(10, trip.priceCents / 100);

  if (request.maxDetourMinutes && detourMinutes > request.maxDetourMinutes) score -= 80;
  if (request.maxPickupDistanceM && route.pickupDistanceMeters > request.maxPickupDistanceM) score -= 80;

  return Math.round(score * 100) / 100;
}

export function buildReasons(request: SearchRequest, trip: Trip, route: RouteComparison): string[] {
  const detourMinutes = Math.round(route.detourDurationSeconds / 60);
  const reasons = [`+${detourMinutes} min détour`, `${trip.seatsAvailable} places disponibles`];

  if (request.teamId && request.teamId === trip.teamId) {
    reasons.push(`Même équipe ${trip.category}`);
  } else if (request.clubId && request.clubId === trip.clubId) {
    reasons.push("Même club");
  }

  if (trip.supportsChildTracking) reasons.push("Suivi enfant disponible");
  if (trip.priceCents === 0) reasons.push("Trajet gratuit");
  if (trip.co2SavedKgEstimate > 0) reasons.push(`${trip.co2SavedKgEstimate.toFixed(1)} kg CO2 économisés`);

  return reasons;
}

export async function rankTrips(
  request: SearchRequest,
  candidates: Trip[],
  routeProvider: RouteComparisonProvider,
  options: { finalRouteLimit?: number } = {},
): Promise<RankedTrip[]> {
  const ranked: RankedTrip[] = [];

  for (const trip of candidates) {
    if (!passesHardFilters(request, trip)) continue;
    let route: RouteComparison;
    try {
      route = await routeProvider.compareDetour(request, trip);
    } catch (error) {
      if (error instanceof RouteUnavailableError) continue;
      throw error;
    }
    const score = scoreCandidate(request, trip, route);
    if (score <= 0) continue;
    ranked.push({
      trip,
      route,
      score,
      reasons: buildReasons(request, trip, route),
    });
  }

  ranked.sort((a, b) => b.score - a.score);

  if (!routeProvider.completeRouteDetails) return ranked;

  const finalRouteLimit = options.finalRouteLimit ?? 12;
  const finalized: RankedTrip[] = [];
  const unfinalized = ranked.slice(finalRouteLimit);

  for (const match of ranked.slice(0, finalRouteLimit)) {
    try {
      const route = await routeProvider.completeRouteDetails(request, match.trip, match.route);
      finalized.push({ ...match, route });
    } catch (error) {
      if (!(error instanceof RouteUnavailableError)) throw error;
    }
  }

  return [...finalized, ...unfinalized];
}
