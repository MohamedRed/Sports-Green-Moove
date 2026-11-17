import { describe, expect, it } from "vitest";
import { passengersReadyForCompletion, transitionPassenger, type PassengerState } from "../domain/passengerTransition.js";

const passenger: PassengerState & { label: string } = {
  bookingId: "booking-1", childId: "child-1", label: "Test passenger",
  pickupStatus: "pending", dropoffStatus: "pending",
};

describe("passenger transitions", () => {
  it("only completes exact, uniquely attached and fully delivered passenger lists", () => {
    const delivered = { ...passenger, pickupStatus: "pickedUp" as const, dropoffStatus: "droppedOff" as const };
    expect(passengersReadyForCompletion([], [])).toBe(true);
    expect(passengersReadyForCompletion(["booking-1"], [delivered])).toBe(true);
    expect(passengersReadyForCompletion(["booking-1"], [passenger])).toBe(false);
    expect(passengersReadyForCompletion(["booking-1"], [{ ...delivered, pickupStatus: "pending" }])).toBe(false);
    expect(passengersReadyForCompletion(["booking-1"], [])).toBe(false);
    expect(passengersReadyForCompletion([], [delivered])).toBe(false);
    expect(passengersReadyForCompletion(["booking-1", "booking-1"], [delivered, delivered])).toBe(false);
  });

  it("requires an exact, unambiguous booking and child match", () => {
    for (const passengers of [[], [passenger, passenger]]) {
      expect(transitionPassenger(passengers, "booking-1", "child-1", "pickup").ok).toBe(false);
    }
    expect(transitionPassenger([passenger], "unknown", "child-1", "pickup").ok).toBe(false);
    expect(transitionPassenger([passenger], "booking-1", "wrong-child", "pickup").ok).toBe(false);
  });

  it("updates one booking without mutating another booking for the same child", () => {
    const other = { ...passenger, bookingId: "booking-2" };
    const result = transitionPassenger([passenger, other], "booking-1", "child-1", "pickup");
    expect(result).toEqual({ ok: true, passengers: [{ ...passenger, pickupStatus: "pickedUp" }, other] });
    expect(passenger.pickupStatus).toBe("pending");
  });

  it("requires pickup before dropoff and refuses repeated confirmations", () => {
    expect(transitionPassenger([passenger], "booking-1", "child-1", "dropoff").ok).toBe(false);
    const pickedUp = { ...passenger, pickupStatus: "pickedUp" as const };
    expect(transitionPassenger([pickedUp], "booking-1", "child-1", "pickup").ok).toBe(false);
    expect(transitionPassenger([pickedUp], "booking-1", "child-1", "dropoff"))
      .toEqual({ ok: true, passengers: [{ ...pickedUp, dropoffStatus: "droppedOff" }] });
    const droppedOff = { ...pickedUp, dropoffStatus: "droppedOff" as const };
    for (const event of ["pickup", "dropoff"] as const) {
      expect(transitionPassenger([droppedOff], "booking-1", "child-1", event).ok).toBe(false);
    }
  });
});
