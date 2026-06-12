import { describe, expect, it } from "vitest";
import { RouteUnavailableError, passesHardFilters, rankTrips, scoreCandidate } from "../domain/matching.js";
import type { RouteComparison, SearchRequest, Trip } from "../domain/types.js";

const request: SearchRequest = {
  requesterUserId: "parent-1",
  childUserId: "child-1",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  desiredDepartureAt: "2026-09-12T14:30:00.000Z",
  origin: { lat: 50.715, lng: 4.612 },
  destination: { lat: 50.67, lng: 4.58 },
  seatsNeeded: 1,
  baggage: "medium",
  returnTrip: true,
  requireChildTracking: true,
  guardianConsent: true,
};

const baseTrip: Trip = {
  id: "trip-1",
  driverUserId: "driver-1",
  status: "published",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  departureAt: "2026-09-12T14:35:00.000Z",
  origin: { lat: 50.716, lng: 4.611 },
  destination: { lat: 50.671, lng: 4.581 },
  pickupRadiusM: 2000,
  seatsTotal: 4,
  seatsAvailable: 2,
  baggage: "large",
  returnTrip: true,
  priceCents: 250,
  driverRating: 4.8,
  driverVerified: true,
  supportsVehicleTracking: true,
  supportsChildTracking: true,
  co2SavedKgEstimate: 4.2,
};

const goodRoute: RouteComparison = {
  baselineDistanceMeters: 5200,
  baselineDurationSeconds: 900,
  detourDistanceMeters: 800,
  detourDurationSeconds: 360,
  pickupDistanceMeters: 420,
  scheduleDeltaMinutes: 5,
};

describe("carpool matching", () => {
  it("rejects trips that cannot support required child tracking", () => {
    expect(passesHardFilters(request, { ...baseTrip, supportsChildTracking: false })).toBe(false);
  });

  it("scores same-team, low-detour trips higher than weak matches", () => {
    const strong = scoreCandidate(request, baseTrip, goodRoute);
    const weak = scoreCandidate(
      { ...request, teamId: "other-team", clubId: "other-club" },
      { ...baseTrip, priceCents: 900, driverRating: 3.1, co2SavedKgEstimate: 0.5 },
      { ...goodRoute, detourDurationSeconds: 1200, pickupDistanceMeters: 2200, scheduleDeltaMinutes: 25 },
    );

    expect(strong).toBeGreaterThan(weak);
  });

  it("returns ranked explainable matches", async () => {
    const matches = await rankTrips(request, [baseTrip, { ...baseTrip, id: "trip-2", priceCents: 800 }], {
      async compareDetour(_request, trip) {
        return trip.id === "trip-1"
          ? goodRoute
          : { ...goodRoute, detourDurationSeconds: 900, detourDistanceMeters: 2200 };
      },
    });

    expect(matches).toHaveLength(2);
    expect(matches[0].trip.id).toBe("trip-1");
    expect(matches[0].reasons).toContain("+6 min détour");
    expect(matches[0].reasons).toContain("Même équipe U8");
  });

  it("skips candidates whose route cannot be calculated", async () => {
    const matches = await rankTrips(request, [baseTrip, { ...baseTrip, id: "trip-2" }], {
      async compareDetour(_request, trip) {
        if (trip.id === "trip-1") throw new RouteUnavailableError("no route");
        return goodRoute;
      },
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].trip.id).toBe("trip-2");
  });
});
