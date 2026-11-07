import { describe, expect, it } from "vitest";
import { manualPassengerAuditEvent, manualPassengerAuditEventId } from "../domain/rideAudit.js";

describe("ride audit events", () => {
  it("builds deterministic ids for manual pickup and dropoff events", () => {
    expect(manualPassengerAuditEventId("pickup", "booking/1", "child/1")).toBe("manual_pickup_booking_1_child_1");
    expect(manualPassengerAuditEventId("dropoff", "booking-1", "child-1")).toBe("manual_dropoff_booking-1_child-1");
  });

  it("normalizes manual pickup audit payloads", () => {
    const recordedAt = { seconds: 123 };

    expect(manualPassengerAuditEvent({
      event: "pickup",
      bookingId: "booking-1",
      childId: "child-1",
      driverUserId: "driver-1",
      note: "  Arrived at east gate.  ",
      recordedAt,
    })).toEqual({
      source: "manual",
      eventType: "passengerPickup",
      action: "pickup",
      bookingId: "booking-1",
      childId: "child-1",
      userId: "driver-1",
      note: "Arrived at east gate.",
      capturedAt: recordedAt,
      recordedAt,
    });
  });

  it("normalizes blank dropoff notes to null", () => {
    expect(manualPassengerAuditEvent({
      event: "dropoff",
      bookingId: "booking-1",
      childId: "child-1",
      driverUserId: "driver-1",
      note: " ",
      recordedAt: "now",
    })).toMatchObject({
      eventType: "passengerDropoff",
      action: "dropoff",
      note: null,
    });
  });
});

