import { describe, expect, it } from "vitest";
import { toClientRideSnapshot, toClientTripSummary } from "../lib/clientTrips.js";
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

  it("maps live trip state to source-aware ride snapshots", () => {
    const now = 1_760_000_000_000;
    const snapshot = toClientRideSnapshot(
      "ride-1",
      "active",
      {
        vehicle: {
          source: "nativeFallback",
          uploadedAt: now - 30_000,
        },
        children: {
          "child-1": {
            source: "radar",
            uploadedAt: now - 45_000,
          },
        },
        meta: {
          radar: {
            etaSeconds: 360,
            updatedAt: now - 20_000,
          },
        },
      },
      {
        passengers: [{
          bookingId: "booking-1",
          childId: "child-1",
          label: "Kévin",
          pickupStatus: "pending",
          dropoffStatus: "pending",
        }],
      },
      now,
    );

    expect(snapshot).toMatchObject({
      rideSessionId: "ride-1",
      status: "Actif",
      vehicleLastUpdateLabel: "Secours GPS · il y a 30 s",
      childLastUpdateLabel: "Radar · il y a 45 s",
      etaLabel: "ETA 6 min",
      stale: false,
      passengers: [{
        bookingId: "booking-1",
        childId: "child-1",
        label: "Kévin",
        pickupStatus: "pending",
        dropoffStatus: "pending",
      }],
    });
  });

  it("marks active rides stale until a fresh vehicle update exists", () => {
    const now = 1_760_000_000_000;

    expect(toClientRideSnapshot("ride-1", "active", null, now).stale).toBe(true);
    expect(toClientRideSnapshot("ride-1", "active", {
      vehicle: {
        source: "radar",
        uploadedAt: now - 91_000,
      },
    }, null, now).stale).toBe(true);
  });

  it("applies passenger status overrides from the ride session", () => {
    const snapshot = toClientRideSnapshot("ride-1", "active", null, {
      passengers: [{
        bookingId: "booking-1",
        childId: "child-1",
        pickupStatus: "pending",
        dropoffStatus: "pending",
      }],
      passengerStatuses: {
        "child-1": {
          pickupStatus: "pickedUp",
          dropoffStatus: "droppedOff",
        },
      },
    }, 1_760_000_000_000);

    expect(snapshot.passengers).toEqual([{
      bookingId: "booking-1",
      childId: "child-1",
      label: "Enfant LD-1",
      pickupStatus: "pickedUp",
      dropoffStatus: "droppedOff",
    }]);
  });
});
