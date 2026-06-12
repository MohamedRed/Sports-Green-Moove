import { describe, expect, it } from "vitest";
import {
  bookingParticipantUserIds,
  canCancelBooking,
  canReadRide,
  isCancellableBookingStatus,
  refundStatusForCancellation,
  rideParticipantUserIds,
} from "../domain/access.js";

describe("access helpers", () => {
  it("derives unique booking and ride participants", () => {
    expect(bookingParticipantUserIds({
      driverUserId: "driver-1",
      parentUserId: "parent-1",
      requesterUserId: "legacy-parent",
    })).toEqual(["parent-1", "driver-1"]);

    expect(rideParticipantUserIds({
      driverUserId: "driver-1",
      participantUserIds: ["parent-1", "parent-1", "driver-1"],
      childUserIds: ["child-1"],
    })).toEqual(["driver-1", "parent-1", "child-1"]);
  });

  it("allows ride reads for driver, participant parent, child device, and admin", () => {
    const ride = {
      driverUserId: "driver-1",
      participantUserIds: ["parent-1"],
      childUserIds: ["child-1"],
    };

    expect(canReadRide("driver-1", ["driver"], ride)).toBe(true);
    expect(canReadRide("parent-1", ["parent"], ride)).toBe(true);
    expect(canReadRide("child-1", ["child"], ride)).toBe(true);
    expect(canReadRide("support", ["admin"], ride)).toBe(true);
    expect(canReadRide("stranger", ["parent"], ride)).toBe(false);
  });

  it("allows only booking parties and admins to cancel", () => {
    const booking = {
      driverUserId: "driver-1",
      parentUserId: "parent-1",
      status: "approved",
    };

    expect(canCancelBooking("parent-1", ["parent"], booking)).toBe(true);
    expect(canCancelBooking("driver-1", ["driver"], booking)).toBe(true);
    expect(canCancelBooking("support", ["admin"], booking)).toBe(true);
    expect(canCancelBooking("other", ["parent"], booking)).toBe(false);
  });

  it("keeps cancellation state decisions explicit", () => {
    expect(isCancellableBookingStatus("requested")).toBe(true);
    expect(isCancellableBookingStatus("approved")).toBe(true);
    expect(isCancellableBookingStatus("completed")).toBe(false);
    expect(refundStatusForCancellation("paid")).toBe("pending");
    expect(refundStatusForCancellation("requiresPayment")).toBe("notRequired");
  });
});
