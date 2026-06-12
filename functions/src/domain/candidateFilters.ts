import type { SearchRequest, Trip } from "./types.js";

export const DEFAULT_DEPARTURE_WINDOW_BEFORE_MINUTES = 180;
export const DEFAULT_DEPARTURE_WINDOW_AFTER_MINUTES = 360;

export type DepartureWindow = {
  fromIso: string;
  toIso: string;
};

export function departureWindowForSearch(request: SearchRequest): DepartureWindow {
  const desired = Date.parse(request.desiredDepartureAt);
  if (Number.isNaN(desired)) {
    return { fromIso: "", toIso: "" };
  }

  const beforeMinutes = request.departureWindowBeforeMinutes ?? DEFAULT_DEPARTURE_WINDOW_BEFORE_MINUTES;
  const afterMinutes = request.departureWindowAfterMinutes ?? DEFAULT_DEPARTURE_WINDOW_AFTER_MINUTES;

  return {
    fromIso: new Date(desired - beforeMinutes * 60_000).toISOString(),
    toIso: new Date(desired + afterMinutes * 60_000).toISOString(),
  };
}

export function isWithinDepartureWindow(request: SearchRequest, trip: Trip): boolean {
  const window = departureWindowForSearch(request);
  if (!window.fromIso || !window.toIso) return false;
  return trip.departureAt >= window.fromIso && trip.departureAt <= window.toIso;
}

export function matchesRegion(request: SearchRequest, trip: Trip): boolean {
  const prefixes = request.regionGeohashPrefixes?.filter(Boolean) ?? [];
  if (prefixes.length === 0) return true;
  if (!trip.regionGeohash) return false;
  return prefixes.some((prefix) => trip.regionGeohash?.startsWith(prefix));
}

export function hasCompatibleMembership(request: SearchRequest, trip: Trip): boolean {
  if (!request.enforceMemberships) return true;

  const clubAllowed = request.allowedClubIds?.includes(trip.clubId) ?? false;
  const teamAllowed = request.allowedTeamIds?.includes(trip.teamId) ?? false;

  if (request.teamId) return teamAllowed;
  if (request.clubId) return clubAllowed;
  return clubAllowed || teamAllowed;
}
