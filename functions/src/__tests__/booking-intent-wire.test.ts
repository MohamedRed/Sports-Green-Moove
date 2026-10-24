import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { bookingIntentRevision, bookingIntentSnapshot, bookingSnapshotRevision } from "../domain/bookingIntent.js";
import { toClientTripSummary } from "../lib/clientTrips.js";
import type { Trip } from "../domain/types.js";

const trip = { id: "trip", departureAt: "2027-01-10T10:00:00.000Z", arrivalBy: null,
  origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 }, priceCents: 250,
  driverUserId: "driver", seatsTotal: 4, seatsAvailable: 4, clubId: "club", category: "U8" } as unknown as Trip;

describe("displayed booking wire normalization", () => {
  it.each([new Date(trip.departureAt), Timestamp.fromDate(new Date(trip.departureAt))])(
    "preserves supported persisted date representations without inventing terms", (departureAt) => {
      const stored = { ...trip, departureAt } as unknown as Trip;
      expect(bookingIntentSnapshot(stored).terms.departureAt).toBe(trip.departureAt);
      expect(bookingIntentRevision(stored)).toBe(bookingIntentRevision(trip));
      const summary = toClientTripSummary(stored);
      expect(summary.bookingIntent.terms.priceCents).toBe(250);
      expect(summary.dateLabel).not.toBe("DATE À CONFIRMER");
    });
  it("compares equivalent ISO representations at millisecond precision, not as differently formatted text", () => {
    const displayed = bookingIntentSnapshot(trip);
    displayed.terms.departureAt = "2027-01-10T12:00:00+02:00";
    expect(bookingSnapshotRevision(displayed)).toBe(bookingIntentRevision(trip));
    displayed.terms.departureAt = "2027-01-10T12:00:00.001+02:00";
    expect(bookingSnapshotRevision(displayed)).not.toBe(bookingIntentRevision(trip));
  });
});
