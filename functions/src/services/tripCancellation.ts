import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema as documentId } from "../domain/chatReference.js";
import { refundStatusForCancellation } from "../domain/access.js";
import { reservationSchema } from "../domain/reservations.js";
import { firestore } from "../lib/firebase.js";
import { loadStoredTripChange } from "./tripChangeState.js";

export const cancellationRequestSchema = z.object({
  tripId: documentId, requestId: z.uuid(), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(5).max(300),
}).strict();
export type CancellationRequest = z.infer<typeof cancellationRequestSchema>;
const tripSchema = z.object({ driverUserId: documentId, status: z.string(),
  seatsTotal: z.number().int().min(1).max(8), seatsAvailable: z.number().int().min(0).max(8),
  activeRideSessionId: documentId.nullish(),
  pendingChangeId: z.string().regex(/^[a-f0-9]{64}$/).nullish(),
}).refine((trip) => trip.seatsAvailable <= trip.seatsTotal);
const receiptSchema = cancellationRequestSchema.extend({ actorUserId: documentId,
  bookingIds: z.array(documentId).max(100), refundPendingCount: z.number().int().min(0).max(100),
  seatsAvailable: z.number().int().min(0).max(8), cancelledAt: z.instanceof(Timestamp),
});
type Receipt = z.infer<typeof receiptSchema>;
export const tripCancellationLimit = 100;

function inconsistent(message: string): never { throw new HttpsError("failed-precondition", message); }
function clientReceipt(receipt: Receipt) {
  return { ...receipt, status: "cancelled" as const, bookingCount: receipt.bookingIds.length,
    cancelledAt: receipt.cancelledAt.toDate().toISOString() };
}

async function loadState(transaction: Transaction, tripId: string, uid: string, admin: boolean) {
  const tripRef = firestore.collection("trips").doc(tripId);
  const snapshot = await transaction.get(tripRef);
  if (!snapshot.exists) throw new HttpsError("not-found", "Trip not found.");
  if (!admin && snapshot.data()?.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can cancel this trip.");
  const parsed = tripSchema.safeParse(snapshot.data());
  if (!parsed.success) inconsistent("Trip metadata must be reconciled before cancellation.");
  const trip = parsed.data;
  const receiptRef = firestore.collection("tripCancellations").doc(tripId);
  const receiptSnap = await transaction.get(receiptRef);
  if (trip.status === "cancelled") {
    const receipt = receiptSchema.safeParse(receiptSnap.data());
    if (!receipt.success || receipt.data.tripId !== tripId) inconsistent("Cancellation receipt is missing or invalid.");
    return { kind: "cancelled" as const, tripRef, trip, receiptRef, receipt: receipt.data };
  }
  if (receiptSnap.exists) inconsistent("Cancellation receipt conflicts with the trip state.");
  if (!["published", "full"].includes(trip.status) || trip.activeRideSessionId) {
    inconsistent("Only a published trip without an active ride can be cancelled.");
  }
  const activeRides = await transaction.get(firestore.collection("rideSessions")
    .where("tripId", "==", tripId).where("status", "==", "active").limit(1));
  if (!activeRides.empty) inconsistent("An active ride must be reconciled before cancellation.");
  const bookings = await transaction.get(firestore.collection("bookings").where("tripId", "==", tripId)
    .where("status", "in", ["requested", "approved"]).limit(tripCancellationLimit + 1));
  if (bookings.size > tripCancellationLimit) throw new HttpsError("resource-exhausted", "Too many reservations for atomic cancellation.");
  const items = bookings.docs.map((doc) => {
    const booking = reservationSchema.safeParse(doc.data());
    if (!booking.success || booking.data.driverUserId !== trip.driverUserId || booking.data.tripId !== tripId ||
        (booking.data.parentUserId && booking.data.requesterUserId && booking.data.parentUserId !== booking.data.requesterUserId)) {
      inconsistent("Reservation ownership or seat metadata must be reconciled before cancellation.");
    }
    return { snapshot: doc, booking: booking.data };
  });
  const returnedSeats = items.reduce((sum, item) => sum + (item.booking.status === "approved" ? item.booking.seats : 0), 0);
  if (trip.seatsAvailable + returnedSeats > trip.seatsTotal) inconsistent("Reserved seats exceed trip capacity.");
  const revision = createHash("sha256").update(JSON.stringify([
    [snapshot.id, snapshot.updateTime], ...items.map((item) => [item.snapshot.id, item.snapshot.updateTime])
      .sort((a, b) => String(a[0]) < String(b[0]) ? -1 : String(a[0]) > String(b[0]) ? 1 : 0),
  ])).digest("hex");
  return { kind: "ready" as const, tripRef, trip, receiptRef, items, revision, returnedSeats };
}

export async function previewTripCancellation(tripId: string, uid: string, admin: boolean) {
  return firestore.runTransaction(async (transaction) => {
    const state = await loadState(transaction, tripId, uid, admin);
    if (state.kind === "cancelled") return clientReceipt(state.receipt);
    return { tripId, status: "ready" as const, revision: state.revision, bookingCount: state.items.length,
      refundPendingCount: state.items.filter((item) => item.booking.paymentStatus === "paid").length };
  });
}

export async function cancelPublishedTrip(data: CancellationRequest, uid: string, admin: boolean) {
  return firestore.runTransaction(async (transaction) => {
    const state = await loadState(transaction, data.tripId, uid, admin);
    if (state.kind === "cancelled") {
      const receipt = state.receipt;
      if (receipt.actorUserId !== uid || receipt.requestId !== data.requestId || receipt.reason !== data.reason ||
          receipt.expectedRevision !== data.expectedRevision) {
        throw new HttpsError("already-exists", "Trip was cancelled by a different request. Refresh its receipt.");
      }
      return clientReceipt(receipt);
    }
    if (state.revision !== data.expectedRevision) throw new HttpsError("aborted", "Trip or reservations changed. Review cancellation again.");
    const proposed = state.trip.pendingChangeId ? await loadStoredTripChange(transaction, data.tripId, state.trip.pendingChangeId) : null;
    if (proposed && (proposed.change.driverUserId !== state.trip.driverUserId || !["pending", "confirmed"].includes(proposed.change.status)))
      inconsistent("Trip change metadata must be reconciled before cancellation.");
    const now = Timestamp.now();
    const items = state.items;
    const receipt: Receipt = { ...data, actorUserId: uid, cancelledAt: now,
      bookingIds: items.map((item) => item.snapshot.id).sort(),
      refundPendingCount: items.filter((item) => item.booking.paymentStatus === "paid").length,
      seatsAvailable: state.trip.seatsAvailable + state.returnedSeats };
    const recipients = new Map<string, string[]>();
    for (const { snapshot, booking } of items) {
      transaction.update(snapshot.ref, { status: "cancelled", cancelledAt: now, cancelledByUserId: uid,
        cancelReason: data.reason, refundStatus: refundStatusForCancellation(booking.paymentStatus), updatedAt: now });
      const parentId = (booking.parentUserId ?? booking.requesterUserId)!;
      recipients.set(parentId, [...(recipients.get(parentId) ?? []), snapshot.id]);
    }
    for (const [userId, bookingIds] of recipients) {
      const notificationId = createHash("sha256").update(JSON.stringify([data.tripId, userId])).digest("hex");
      transaction.create(firestore.collection("notifications").doc(`tripCancelled_${notificationId}`), {
        userId, type: "tripCancelled", title: "Trajet annulé", body: data.reason, sourceId: data.tripId,
        bookingIds: bookingIds.sort(), read: false, createdAt: now,
      });
    }
    transaction.update(state.tripRef, { status: "cancelled", seatsAvailable: receipt.seatsAvailable,
      approvedPassengerUserIds: [], cancelledAt: now, cancelledByUserId: uid, cancelReason: data.reason, updatedAt: now,
      ...(proposed ? { pendingChangeId: FieldValue.delete() } : {}) });
    if (proposed) transaction.update(proposed.ref, { status: "cancelled", updatedAt: now });
    transaction.create(state.receiptRef, receipt);
    return clientReceipt(receipt);
  });
}
