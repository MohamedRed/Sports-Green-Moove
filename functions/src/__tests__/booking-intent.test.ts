import { describe, expect, it } from "vitest";
import { bookingIntentRevision } from "../domain/bookingIntent.js";
import type { Trip } from "../domain/types.js";

const trip = { driverUserId: "driver", clubId: "club", teamId: "team", category: "U 7/8",
  departureAt: "2027-01-10T10:00:00.000Z", origin: { lat: 50.7, lng: 4.6 },
  destination: { lat: 50.8, lng: 4.3 }, priceCents: 250, pickupRadiusM: 1500,
  baggage: "medium", returnTrip: false, supportsVehicleTracking: true, supportsChildTracking: true,
  seatsTotal: 4, seatsAvailable: 4, status: "published", title: "Initial" } as Trip;

describe("server-side booking intent revision", () => {
  it.each([
    { priceCents: 300 }, { departureAt: "2027-01-10T11:00:00.000Z" },
    { arrivalBy: "2027-01-10T12:00:00.000Z" }, { origin: { lat: 50.71, lng: 4.6 } },
    { destination: { lat: 50.81, lng: 4.3 } }, { appliedChangeId: "a".repeat(64) },
    { driverUserId: "another-driver" }, { clubId: "other-club" }, { teamId: "other-team" },
    { category: "U 9/10" }, { pickupRadiusM: 3000 }, { baggage: "small" as const },
    { returnTrip: true }, { supportsVehicleTracking: false }, { supportsChildTracking: false }, { seatsTotal: 5 },
  ])("invalidates changed operational terms: %j", (patch) => {
    expect(bookingIntentRevision({ ...trip, ...patch })).not.toBe(bookingIntentRevision(trip));
  });

  it("does not turn a title edit, update timestamp or available-seat change into consent to new terms", () => {
    expect(bookingIntentRevision({ ...trip, title: "Updated", seatsAvailable: 3, updatedAt: "new" } as Trip))
      .toBe(bookingIntentRevision(trip));
    expect(bookingIntentRevision({ ...trip, arrivalBy: undefined })).toBe(bookingIntentRevision(trip));
  });

  it.each([{ priceCents: -1 }, { priceCents: Number.NaN }, { priceCents: 100001 },
    { departureAt: "invalid" }, { arrivalBy: "2026-01-10T10:00:00.000Z" }, { origin: { lat: 100, lng: 4 } },
    { seatsAvailable: undefined }, { seatsAvailable: 5 }, { driverUserId: "drivers/other" }, { appliedChangeId: "invalid" }])
  ("rejects malformed terms instead of synthesizing an agreement: %j", (patch) => {
    expect(() => bookingIntentRevision({ ...trip, ...patch } as Trip)).toThrow();
  });
});
