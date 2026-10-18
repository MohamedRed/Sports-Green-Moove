import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { recordedRidePaymentState } from "../domain/ridePaymentStatus.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

const schema = z.object({ bookingId: chatDocumentIdSchema, paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]+$/).max(256) }).strict();

export const getRidePaymentStatus = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "parent");
  const { bookingId, paymentIntentId } = parseCallableData(schema, request.data);
  return firestore.runTransaction(async (transaction) => {
    const booking = (await transaction.get(firestore.collection("bookings").doc(bookingId))).data();
    if (!booking || (booking.parentUserId ?? booking.requesterUserId) !== uid) throw new HttpsError("permission-denied", "This payment is not accessible.");
    // Derive ledger paths only from authenticated, server-owned booking fields.
    const driverId = chatDocumentIdSchema.safeParse(booking.driverUserId);
    if (!driverId.success) return { bookingId, paymentIntentId, state: "review" };
    const [receipt, payer, driver] = await transaction.getAll(
      firestore.collection("ridePaymentReceipts").doc(paymentIntentId),
      firestore.collection("rewardLedger").doc(`${paymentIntentId}_ridePayment_${uid}`),
      firestore.collection("rewardLedger").doc(`${paymentIntentId}_driverEarning_${driverId.data}`),
    );
    return { bookingId, paymentIntentId,
      state: recordedRidePaymentState(bookingId, paymentIntentId, booking, receipt.data(), payer.data(), driver.data()) };
  });
});
