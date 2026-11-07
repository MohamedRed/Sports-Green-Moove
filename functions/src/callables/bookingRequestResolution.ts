import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { bookingRequestDocumentId, bookingRequestIdSchema, requireReceiptOwner,
  type BookingRequestReceipt } from "../domain/bookingRequestIdentity.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { chatDocumentIdSchema } from "../domain/chatReference.js";

// Atomically resolve an old uncertain operation before accepting a changed intent.
// An abandonment fences a late request; it never cancels a committed booking.
export const resolveBookingRequest = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "parent");
  const { clientRequestId, requesterUserId } = parseCallableData(z.object({ clientRequestId: bookingRequestIdSchema,
    requesterUserId: chatDocumentIdSchema }).strict(), request.data);
  if (requesterUserId !== uid) throw new HttpsError("permission-denied", "Booking account changed. Sign in again.");
  const ref = firestore.collection("bookingRequestReceipts").doc(bookingRequestDocumentId(uid, clientRequestId));
  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      const receipt = existing.data() as BookingRequestReceipt;
      requireReceiptOwner(receipt, uid, clientRequestId);
      return receipt.state === "committed" ? { state: "committed", clientRequestId, bookingId: receipt.response!.bookingId }
        : { state: "abandoned", clientRequestId };
    }
    transaction.create(ref, { uid, clientRequestId, state: "abandoned", createdAt: Timestamp.now() });
    return { state: "abandoned", clientRequestId };
  });
});
