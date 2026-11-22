import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { bookingIntentRevision, bookingSnapshotRevision } from "../domain/bookingIntent.js";
import { bookingRequestSchema, bookingRequestDocumentId, bookingRequestFingerprint, requireReceiptOwner,
  type BookingRequestReceipt } from "../domain/bookingRequestIdentity.js";
import { childDisplayLabel, type ChildProfileDocument } from "../domain/children.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { toClientTripSummary } from "../lib/clientTrips.js";
import { parseCallableData } from "../lib/validation.js";
import { createBookingNotifications } from "../lib/bookingNotifications.js";

function requireBookableTrip(trip: Trip, uid: string, seats: number) {
  if (trip.status !== "published" || trip.activeRideSessionId || trip.pendingChangeId)
    throw new HttpsError("failed-precondition", "Trip is not available.");
  if (trip.driverUserId === uid) throw new HttpsError("failed-precondition", "Drivers cannot book their own trip.");
  if (trip.seatsAvailable < seats) throw new HttpsError("failed-precondition", "Not enough seats available.");
}

function intentRevision(trip: Trip) {
  try { return bookingIntentRevision(trip); }
  catch { throw new HttpsError("failed-precondition", "Trip terms must be reconciled before booking."); }
}

async function loadCurrentChild(transaction: Transaction, uid: string, childId: string) {
  const snapshot = await transaction.get(firestore.collection("children").doc(childId));
  const child = snapshot.data() as ChildProfileDocument | undefined;
  if (!snapshot.exists || !isGuardianOfChild(child, uid))
    throw new HttpsError("permission-denied", "Only a guardian can book a trip for this child.");
  return child;
}

export const requestBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "parent");
  const data = parseCallableData(bookingRequestSchema, request.data);
  if (data.requesterUserId !== uid) throw new HttpsError("permission-denied", "Booking account changed. Sign in again.");
  const bookingRef = firestore.collection("bookings").doc();
  const receiptRef = firestore.collection("bookingRequestReceipts").doc(bookingRequestDocumentId(uid, data.clientRequestId));
  const fingerprint = bookingRequestFingerprint(data);
  const tripRef = firestore.collection("trips").doc(data.tripId);
  const expectedRevision = bookingSnapshotRevision(data.expectedBookingIntent);

  // The client's displayed snapshot stays fixed across every transaction attempt.
  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(receiptRef);
    if (existing.exists) {
      const receipt = existing.data() as BookingRequestReceipt;
      requireReceiptOwner(receipt, uid, data.clientRequestId);
      if (receipt.state === "abandoned") throw new HttpsError("failed-precondition", "This booking request was abandoned.");
      if (receipt.fingerprint !== fingerprint) throw new HttpsError("already-exists", "Request ID already used for different booking details.");
      const booking = (await transaction.get(firestore.collection("bookings").doc(receipt.response!.bookingId))).data();
      if (!booking || booking.parentUserId !== uid || booking.tripId !== data.tripId ||
          !["requested", "approved", "declined", "cancelled", "completed"].includes(booking.status)) {
        throw new HttpsError("internal", "Original booking must be reconciled.");
      }
      return { ...receipt.response!, currentBookingStatus: booking.status as string, reused: true };
    }
    const snapshot = await transaction.get(tripRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = { id: snapshot.id, ...snapshot.data() } as Trip;
    requireBookableTrip(trip, uid, data.seats);
    if (intentRevision(trip) !== expectedRevision)
      throw new HttpsError("aborted", "Trip details changed. Review the current trip before booking.");
    const child = data.childId ? await loadCurrentChild(transaction, uid, data.childId) : undefined;
    const now = Timestamp.now();
    transaction.create(bookingRef, {
      tripId: data.tripId, parentUserId: uid, requesterUserId: uid, driverUserId: trip.driverUserId,
      seats: data.seats, status: "requested", createdAt: now, updatedAt: now,
      ...(trip.appliedChangeId ? { agreedPriceCents: trip.priceCents, agreedAmountCents: trip.priceCents * data.seats,
        tripTermsRevision: trip.appliedChangeId } : {}),
      ...(data.childId ? { childId: data.childId, childLabel: childDisplayLabel(child, data.childId) } : {}),
      ...(data.note ? { note: data.note } : {}),
    });
    const response = { bookingId: bookingRef.id, clientRequestId: data.clientRequestId,
      status: "requested" as const, trip: toClientTripSummary(trip) };
    transaction.create(receiptRef, { uid, clientRequestId: data.clientRequestId, fingerprint,
      state: "committed", response, createdAt: now });
    createBookingNotifications(transaction, [trip.driverUserId], { type: "bookingRequested", sourceId: bookingRef.id,
      title: "Nouvelle demande de réservation", body: "Une nouvelle demande de réservation attend votre réponse." });
    return { ...response, currentBookingStatus: "requested", reused: false };
  });
});
