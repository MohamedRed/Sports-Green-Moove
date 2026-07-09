import { describe, expect, it } from "vitest";
import {
  buildPublishedTrip,
  createTripSeatsAreValid,
  driverPublishState,
  type CreateTripInput,
} from "../domain/publishTrip.js";

const input: CreateTripInput = {
  title: "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
  sport: "Football",
  clubName: "Royal Ottignies",
  teamName: "U8 Nationaux",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  departureAt: "2026-09-12T14:35:00.000Z",
  origin: { lat: 50.716, lng: 4.611 },
  destination: { lat: 50.671, lng: 4.581 },
  pickupRadiusM: 2000,
  seatsTotal: 4,
  seatsAvailable: 2,
  baggage: "medium",
  returnTrip: true,
  priceCents: 250,
  supportsVehicleTracking: true,
  supportsChildTracking: true,
  co2SavedKgEstimate: 4.2,
  distanceKm: 5.2,
};

describe("published trip construction", () => {
  it("builds a published trip from explicit client inputs and trusted driver state", () => {
    const trip = buildPublishedTrip("trip-1", "driver-1", input, {
      driverVerified: true,
      driverRating: 4.7,
    });

    expect(trip).toMatchObject({
      id: "trip-1",
      driverUserId: "driver-1",
      status: "published",
      origin: input.origin,
      destination: input.destination,
      driverVerified: true,
      driverRating: 4.7,
    });
  });

  it("omits undefined optional fields from Firestore documents", () => {
    const { distanceKm: _distanceKm, teamName: _teamName, ...minimalInput } = input;
    const trip = buildPublishedTrip("trip-1", "driver-1", minimalInput, {
      driverVerified: true,
      driverRating: 4.7,
    });

    expect(Object.entries(trip).filter(([, value]) => value === undefined)).toEqual([]);
    expect(trip).not.toHaveProperty("arrivalBy");
    expect(trip).not.toHaveProperty("distanceKm");
    expect(trip).not.toHaveProperty("regionGeohash");
    expect(trip).not.toHaveProperty("teamName");
    expect(trip.passengerInitials).toEqual([]);
    expect(trip.blockedUserIds).toEqual([]);
  });

  it("derives publish eligibility and clamps driver rating from profile state", () => {
    expect(driverPublishState({ driverVerified: true, driverRating: 9 })).toEqual({
      driverVerified: true,
      driverRating: 5,
    });
    expect(driverPublishState({ driverVerified: false, driverRating: 4 })).toEqual({
      driverVerified: false,
      driverRating: 4,
    });
    expect(driverPublishState(undefined)).toEqual({
      driverVerified: false,
      driverRating: 0,
    });
  });

  it("rejects seat availability greater than total vehicle seats", () => {
    expect(createTripSeatsAreValid({ seatsAvailable: 2, seatsTotal: 4 })).toBe(true);
    expect(createTripSeatsAreValid({ seatsAvailable: 5, seatsTotal: 4 })).toBe(false);
  });
});
