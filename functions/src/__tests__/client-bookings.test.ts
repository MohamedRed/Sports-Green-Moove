import { describe, expect, it } from "vitest";
import { toClientBookingRequestSummary } from "../lib/clientBookings.js";
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
};

describe("client booking request summaries", () => {
  it("maps requested booking documents to driver queue DTOs", () => {
    const summary = toClientBookingRequestSummary({
      id: "booking-1",
      tripId: "trip-1",
      parentUserId: "parent-1",
      childId: "child-1",
      seats: 2,
      note: "Besoin du siège enfant",
      status: "requested",
    }, trip);

    expect(summary.bookingId).toBe("booking-1");
    expect(summary.parentUserId).toBe("parent-1");
    expect(summary.childId).toBe("child-1");
    expect(summary.seats).toBe(2);
    expect(summary.note).toBe("Besoin du siège enfant");
    expect(summary.status).toBe("requested");
    expect(summary.title).toBe("U8 NATIONAUX VS ROYAL OTTIGNIES SC");
    expect(summary.club).toBe("Royal Ottignies");
    expect(summary.priceLabel).toBe("2,50 EUR");
  });
});
