import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { recordedRidePaymentState } from "../domain/ridePaymentStatus.js";

function fixture() {
  const booking = { parentUserId: "parent", driverUserId: "driver", tripId: "trip", status: "approved",
    paymentIntentId: "pi_owned", paymentStatus: "paid", paymentPriceCents: 200, seats: 2, amountPaidCents: 400 };
  const receipt = { paymentIntentId: "pi_owned", bookingId: "booking", tripId: "trip", payerUserId: "parent", driverUserId: "driver",
    currency: "eur", amountCents: 400, platformFeeCents: 20, kind: "original", createdAt: Timestamp.now(), refundedCents: 0, refundReservedCents: 0 };
  const common = { currency: "eur", sourceId: "pi_owned", bookingId: "booking", tripId: "trip" };
  const payer = { ...common, userId: "parent", type: "ridePayment", amountCents: -400 };
  const driver = { ...common, userId: "driver", type: "driverEarning", amountCents: 380 };
  return { booking, receipt, payer, driver };
}
describe("read-only ride payment reconciliation status", () => {
  it("requires matching booking, immutable receipt and both ledger entries", () => {
    const { booking, receipt, payer, driver } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", booking, receipt, payer, driver)).toBe("recorded");
  });
  it("keeps a delayed webhook pending and does not infer success from checkout", () => {
    const { booking } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", { ...booking, paymentStatus: "processing" }, undefined, undefined, undefined)).toBe("pending");
  });
  it.each(["failed", "canceled"])("reports only a server-recorded %s outcome", (paymentStatus) => {
    const { booking } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", { ...booking, paymentStatus }, undefined, undefined, undefined)).toBe(paymentStatus);
  });
  it.each(["paymentIntentId", "bookingId", "tripId", "payerUserId", "driverUserId", "currency", "kind"])("rejects a receipt with changed %s", (field) => {
    const { booking, receipt, payer, driver } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", booking, { ...receipt, [field]: "wrong" }, payer, driver)).toBe("review");
  });
  it.each(["amountCents", "platformFeeCents", "refundedCents", "refundReservedCents"])("does not confirm inconsistent or refunded %s", (field) => {
    const { booking, receipt, payer, driver } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", booking, { ...receipt, [field]: 1 }, payer, driver)).toBe("review");
  });
  it("does not infer payment from a paid flag, missing ledger or old attempt", () => {
    const { booking, receipt, payer, driver } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", booking, undefined, payer, driver)).toBe("review");
    expect(recordedRidePaymentState("booking", "pi_owned", booking, receipt, undefined, driver)).toBe("review");
    expect(recordedRidePaymentState("booking", "pi_other", booking, receipt, payer, driver)).toBe("review");
    expect(recordedRidePaymentState("booking", "pi_owned", { ...booking, paymentStatus: "failed" }, receipt, payer, driver)).toBe("review");
  });
  it("does not turn cancelled or refund-pending bookings into payment success", () => {
    const { booking, receipt, payer, driver } = fixture();
    for (const change of [{ status: "cancelled" }, { refundStatus: "pending" }, { amountPaidCents: 399 }])
      expect(recordedRidePaymentState("booking", "pi_owned", { ...booking, ...change }, receipt, payer, driver)).toBe("review");
  });
  it.each(["userId", "type", "amountCents", "currency", "sourceId", "bookingId", "tripId"])("checks each ledger %s field", (field) => {
    const { booking, receipt, payer, driver } = fixture();
    expect(recordedRidePaymentState("booking", "pi_owned", booking, receipt, { ...payer, [field]: "wrong" }, driver)).toBe("review");
    expect(recordedRidePaymentState("booking", "pi_owned", booking, receipt, payer, { ...driver, [field]: "wrong" })).toBe("review");
  });
});
