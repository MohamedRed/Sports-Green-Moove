import { afterEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import type { Trip } from "../domain/types.js";
import { bookingIntentRevision } from "../domain/bookingIntent.js";
import { toClientTripSummary } from "../lib/clientTrips.js";
import { toClientBookingRequestSummary } from "../lib/clientBookings.js";

const base: Trip = {
  id: "trip-dates", driverUserId: "driver-dates", status: "published", clubId: "club-dates",
  category: "U8", departureAt: "2026-10-19T11:50:00.000Z",
  origin: { lat: 50.7, lng: 4.6 }, destination: { lat: 50.8, lng: 4.3 },
  pickupRadiusM: 1000, seatsTotal: 4, seatsAvailable: 2, baggage: "small", returnTrip: false,
  priceCents: 250, driverRating: 5, driverVerified: true,
  supportsVehicleTracking: true, supportsChildTracking: false, co2SavedKgEstimate: 1,
};
const booking = { id: "booking-dates", tripId: base.id, parentUserId: "parent-dates", status: "approved" };
const cases = [
  ["reported reservation mismatch", "2026-10-19T11:50:00.000Z", "LUN 19 OCT.", "13h50"],
  ["winter offset", "2026-01-15T11:50:00.000Z", "JEU 15 JANV.", "12h50"],
  ["summer next day", "2026-07-01T22:30:00.000Z", "JEU 02 JUIL.", "00h30"],
  ["winter next year", "2026-12-31T23:30:00.000Z", "VEN 01 JANV.", "00h30"],
  ["before spring clock change", "2026-03-29T00:59:00.000Z", "DIM 29 MARS", "01h59"],
  ["after spring clock change", "2026-03-29T01:00:00.000Z", "DIM 29 MARS", "03h00"],
  ["before autumn clock change", "2026-10-25T00:59:00.000Z", "DIM 25 OCT.", "02h59"],
  ["after autumn clock change", "2026-10-25T01:00:00.000Z", "DIM 25 OCT.", "02h00"],
  ["first repeated autumn time", "2026-10-25T00:30:00.000Z", "DIM 25 OCT.", "02h30"],
  ["second repeated autumn time", "2026-10-25T01:30:00.000Z", "DIM 25 OCT.", "02h30"],
] as const;

afterEach(() => vi.useRealTimers());

describe("Belgian trip and reservation dates", () => {
  it.each(cases)("formats %s consistently without changing stored terms", (_name, departureAt, dateLabel, timeLabel) => {
    const trip = { ...base, departureAt };
    const original = structuredClone(trip);
    const revision = bookingIntentRevision(trip);
    const summary = toClientTripSummary(trip);
    const request = toClientBookingRequestSummary(booking, trip);
    expect(summary).toMatchObject({ dateLabel, timeLabel, departureLabel: `${dateLabel} · ${timeLabel}` });
    expect(request).toMatchObject({ dateLabel, timeLabel });
    expect(summary.bookingIntent.terms.departureAt).toBe(departureAt);
    expect(trip).toEqual(original);
    expect(bookingIntentRevision(trip)).toBe(revision);
  });

  it.each([
    "2026-10-19T13:50:00+02:00",
    new Date(base.departureAt),
    Timestamp.fromDate(new Date(base.departureAt)),
  ])("normalizes supported stored representations before Belgian display: %s", (departureAt) => {
    const trip = { ...base, departureAt } as unknown as Trip;
    expect(toClientTripSummary(trip)).toMatchObject({ dateLabel: "LUN 19 OCT.", timeLabel: "13h50" });
    expect(toClientBookingRequestSummary(booking, trip)).toMatchObject({ dateLabel: "LUN 19 OCT.", timeLabel: "13h50" });
    expect(bookingIntentRevision(trip)).toBe(bookingIntentRevision(base));
  });

  it("keeps past/upcoming status based on the instant, not the displayed local date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T11:49:59.999Z"));
    expect(toClientTripSummary(base).status).toBe("upcoming");
    vi.setSystemTime(new Date(base.departureAt));
    expect(toClientTripSummary(base).status).toBe("upcoming");
    vi.setSystemTime(new Date("2026-10-19T11:50:00.001Z"));
    expect(toClientTripSummary(base).status).toBe("past");
  });

  it("does not confuse the repeated autumn hour with an identical instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T01:00:00.000Z"));
    const first = { ...base, departureAt: "2026-10-25T00:30:00.000Z" };
    const second = { ...base, departureAt: "2026-10-25T01:30:00.000Z" };
    expect(toClientTripSummary(first)).toMatchObject({ timeLabel: "02h30", status: "past" });
    expect(toClientTripSummary(second)).toMatchObject({ timeLabel: "02h30", status: "upcoming" });
    expect(bookingIntentRevision(first)).not.toBe(bookingIntentRevision(second));
  });
});
