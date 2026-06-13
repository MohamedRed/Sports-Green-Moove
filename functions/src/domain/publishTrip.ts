import type { LatLng, Trip } from "./types.js";

export type CreateTripInput = {
  title: string;
  sport: string;
  clubName: string;
  teamName?: string;
  clubId: string;
  teamId: string;
  category: string;
  departureAt: string;
  arrivalBy?: string;
  origin: LatLng;
  destination: LatLng;
  pickupRadiusM: number;
  seatsTotal: number;
  seatsAvailable: number;
  baggage: "small" | "medium" | "large";
  returnTrip: boolean;
  priceCents: number;
  supportsVehicleTracking: boolean;
  supportsChildTracking: boolean;
  co2SavedKgEstimate: number;
  distanceKm?: number;
  passengerInitials?: string[];
  regionGeohash?: string;
  blockedUserIds?: string[];
};

export type DriverPublishState = {
  driverVerified: boolean;
  driverRating: number;
};

export function createTripSeatsAreValid(input: Pick<CreateTripInput, "seatsAvailable" | "seatsTotal">): boolean {
  return input.seatsAvailable <= input.seatsTotal;
}

export function driverPublishState(profile: Record<string, unknown> | undefined): DriverPublishState {
  return {
    driverVerified: profile?.driverVerified === true,
    driverRating: ratingValue(profile?.driverRating),
  };
}

export function buildPublishedTrip(
  id: string,
  driverUserId: string,
  input: CreateTripInput,
  driver: DriverPublishState,
): Trip {
  return {
    id,
    driverUserId,
    status: "published",
    title: input.title,
    sport: input.sport,
    clubName: input.clubName,
    teamName: input.teamName,
    clubId: input.clubId,
    teamId: input.teamId,
    category: input.category,
    departureAt: input.departureAt,
    arrivalBy: input.arrivalBy,
    origin: input.origin,
    destination: input.destination,
    pickupRadiusM: input.pickupRadiusM,
    seatsTotal: input.seatsTotal,
    seatsAvailable: input.seatsAvailable,
    baggage: input.baggage,
    returnTrip: input.returnTrip,
    priceCents: input.priceCents,
    driverRating: driver.driverRating,
    driverVerified: driver.driverVerified,
    supportsVehicleTracking: input.supportsVehicleTracking,
    supportsChildTracking: input.supportsChildTracking,
    co2SavedKgEstimate: input.co2SavedKgEstimate,
    distanceKm: input.distanceKm,
    passengerInitials: input.passengerInitials ?? [],
    regionGeohash: input.regionGeohash,
    blockedUserIds: input.blockedUserIds ?? [],
  };
}

function ratingValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(5, value))
    : 0;
}
