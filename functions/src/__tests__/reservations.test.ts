import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { reservationActions, reservationSchema, type Reservation } from "../domain/reservations.js";
import { directoryCursor, parseDirectoryCursor } from "../lib/chatDirectoryCursor.js";
import type { Trip } from "../domain/types.js";

const booking: Reservation & { id: string } = { id: "booking", tripId: "trip", driverUserId: "driver", parentUserId: "parent", seats: 2, status: "requested" };
const trip = { id: "trip", driverUserId: "driver", status: "published" } as Trip;
describe("reservation decisions", () => {
  it("allows only the owning driver to decide a pending open request", () => {
    expect(reservationActions("driver", "driver", booking, trip, undefined)).toEqual(["approve", "decline"]);
    expect(reservationActions("other", "driver", booking, trip, undefined)).toEqual([]);
    expect(reservationActions("driver", "driver", booking, { ...trip, driverUserId: "other" }, undefined)).toEqual([]);
    for (const status of ["approved", "declined", "cancelled", "completed"] as const) {
      expect(reservationActions("driver", "driver", { ...booking, status }, trip, undefined)).toEqual([]);
    }
    expect(reservationActions("driver", "driver", booking, { ...trip, status: "completed" }, undefined)).toEqual([]);
    expect(reservationActions("driver", "driver", booking, { ...trip, activeRideSessionId: "ride" }, undefined)).toEqual([]);
    expect(reservationActions("driver", "driver", { ...booking, paymentStatus: "paid" }, trip, undefined)).toEqual([]);
  });
  it("allows guardian cancellation but never authorizes another owner or terminal booking", () => {
    expect(reservationActions("parent", "parent", booking, trip, undefined)).toEqual(["cancel"]);
    expect(reservationActions("other", "parent", booking, trip, undefined)).toEqual([]);
    expect(reservationActions("driver", "parent", booking, trip, undefined)).toEqual([]);
    for (const status of ["declined", "cancelled", "completed"] as const) {
      expect(reservationActions("parent", "parent", { ...booking, status }, trip, undefined)).toEqual([]);
    }
  });
  it("blocks an active passenger and fails closed on missing active-ride membership", () => {
    const approved = { ...booking, status: "approved" as const };
    const active = { ...trip, activeRideSessionId: "ride" };
    expect(reservationActions("parent", "parent", approved, trip, undefined)).toEqual(["cancel"]);
    for (const ride of [undefined, null, {}, { bookingIds: [booking.id] }]) {
      expect(reservationActions("parent", "parent", approved, active, ride)).toEqual([]);
    }
    expect(reservationActions("parent", "parent", approved, active, { bookingIds: ["different"] })).toEqual(["cancel"]);
  });
  it("does not invent missing owner, seat counts or status", () => {
    expect(reservationSchema.safeParse(booking).success).toBe(true);
    for (const change of [{ seats: undefined }, { seats: 0 }, { seats: 1.5 }, { status: "unknown" }, { parentUserId: undefined }, { tripId: "bad/id" }]) {
      expect(reservationSchema.safeParse({ ...booking, ...change }).success).toBe(false);
    }
  });
  it("binds page cursors to the owner and selected role", () => {
    const at = new Timestamp(10, 25);
    const cursor = directoryCursor("parent-reservations", "parent", at, "booking");
    expect(parseDirectoryCursor(cursor, "parent-reservations", "parent")).toEqual([at, "booking"]);
    expect(() => parseDirectoryCursor(cursor, "driver-reservations", "parent")).toThrow(/different list/);
    expect(() => parseDirectoryCursor(cursor, "parent-reservations", "other")).toThrow(/another user/);
  });
});
