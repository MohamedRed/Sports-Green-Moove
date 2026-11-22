import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { ridePaymentIntent, stripeEvent } from "./stripe-webhook-fixtures.js";

export function registerRidePaymentStatusChecks(dependencies: () => {
  firestore: Firestore;
  seedRidePaymentContext: (overrides?: Record<string, unknown>) => Promise<void>;
  reconcileStripeEvent: (event: ReturnType<typeof stripeEvent>) => Promise<void>;
}) {
  const read = async (uid: string | null = "parent-1", roleKeys = ["parent"], data: unknown = {
    bookingId: "booking-1", paymentIntentId: "pi_ride_1",
  }) => {
    const { getRidePaymentStatus } = await import("../../functions/src/callables/ridePaymentStatus.js");
    return getRidePaymentStatus.run({ data, ...(uid ? { auth: { uid, token: { roleKeys } } } : {}) } as Parameters<typeof getRidePaymentStatus.run>[0]);
  };
  const seed = () => dependencies().seedRidePaymentContext({ paymentPriceCents: 250, paymentStatus: "processing", status: "approved" });
  const pay = async () => {
    await seed();
    await dependencies().reconcileStripeEvent(stripeEvent("evt_status_success", "payment_intent.succeeded", ridePaymentIntent()));
  };
  describe("owned read-only ride payment status", () => {
    it("keeps a delayed event pending and confirms only after reconciled receipt and ledger", async () => {
      await seed();
      expect((await read()).state).toBe("pending");
      await dependencies().reconcileStripeEvent(stripeEvent("evt_status_success", "payment_intent.succeeded", ridePaymentIntent()));
      expect(await read()).toEqual({ bookingId: "booking-1", paymentIntentId: "pi_ride_1", state: "recorded" });
    });
    it("denies signed-out, wrong-role, missing-booking and other-parent access", async () => {
      await pay();
      await expect(read(null)).rejects.toMatchObject({ code: "unauthenticated" });
      await expect(read("parent-1", ["driver"])).rejects.toMatchObject({ code: "permission-denied" });
      await expect(read("other-parent")).rejects.toMatchObject({ code: "permission-denied" });
      await expect(read("parent-1", ["parent"], { bookingId: "missing", paymentIntentId: "pi_ride_1" }))
        .rejects.toMatchObject({ code: "permission-denied" });
    });
    it.each([
      { bookingId: "other/path", paymentIntentId: "pi_ride_1" },
      { bookingId: "booking-1", paymentIntentId: "pi_/other" },
      { bookingId: "booking-1", paymentIntentId: "pi_ride_1", userId: "parent-1" },
      { bookingId: "booking-1" },
    ])("rejects malformed or client-selected ownership: %j", async (data) => {
      await expect(read("parent-1", ["parent"], data)).rejects.toMatchObject({ code: "invalid-argument" });
    });
    it.each(["ridePaymentReceipts/pi_ride_1", "rewardLedger/pi_ride_1_ridePayment_parent-1", "rewardLedger/pi_ride_1_driverEarning_driver-1"])
      ("does not confirm a paid flag without %s", async (path) => {
        await pay();
        await dependencies().firestore.doc(path).delete();
        expect((await read()).state).toBe("review");
      });
    it("returns no money, secrets or private identities and does not mutate any payment record", async () => {
      await pay();
      const db = dependencies().firestore;
      const snapshot = async () => {
        const result: Record<string, unknown> = {};
        for (const collection of ["bookings", "trips", "ridePaymentReceipts", "rewardLedger", "reports", "ridePaymentAttempts"])
          result[collection] = (await db.collection(collection).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        return result;
      };
      const before = await snapshot();
      for (let index = 0; index < 3; index++)
        expect(await read()).toEqual({ bookingId: "booking-1", paymentIntentId: "pi_ride_1", state: "recorded" });
      expect(await snapshot()).toEqual(before);
    });
    it("does not confirm another intent or a cancelled booking awaiting refund", async () => {
      await pay();
      expect((await read("parent-1", ["parent"], { bookingId: "booking-1", paymentIntentId: "pi_unrelated" })).state).toBe("review");
      await dependencies().firestore.doc("bookings/booking-1").update({ status: "cancelled", refundStatus: "pending" });
      expect((await read()).state).toBe("review");
    });
  });
}
