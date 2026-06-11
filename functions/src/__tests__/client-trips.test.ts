import { describe, expect, it } from "vitest";
import { toClientTripSummary } from "../lib/clientTrips.js";
import type { Trip } from "../domain/types.js";

const trip: Trip = {
  id: "trip-1",
  driverUserId: "driver-1",
  status: "published",
  title: "U8 NATIONAUX VS ROYAL OTTIGNIES SC",
  sport: "Football",
  clubName: "Royal Ottignies",
  clubId: "club-royal",
  teamId: "team-u8",
  category: "U8",
  departureAt: "2099-11-07T15:45:00.000Z",
  origin: { lat: 50.716, lng: 4.611 },
  destination: { lat: 50.671, lng: 4.581 },
  pickupRadiusM: 2000,
  seatsTotal: 4,
  seatsAvailable: 2,
  baggage: "medium",
  returnTrip: false,
  priceCents: 250,
  driverRating: 4.8,
  driverVerified: true,
  supportsVehicleTracking: true,
  supportsChildTracking: true,
  co2SavedKgEstimate: 4.2,
  distanceKm: 5.2,
  passengerInitials: ["IB", "NT"],
};

describe("client trip summaries", () => {
  it("maps Firestore trips to native app DTOs", () => {
    const summary = toClientTripSummary(trip);

    expect(summary.id).toBe("trip-1");
    expect(summary.title).toBe("U8 NATIONAUX VS ROYAL OTTIGNIES SC");
    expect(summary.club).toBe("Royal Ottignies");
    expect(summary.sport).toBe("Football");
    expect(summary.distanceLabel).toBe("5.2 km");
    expect(summary.seatsLabel).toBe("2 places");
    expect(summary.priceLabel).toBe("2,50 EUR");
    expect(summary.passengerInitials).toEqual(["IB", "NT"]);
    expect(summary.status).toBe("upcoming");
  });
});
