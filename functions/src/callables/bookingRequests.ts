import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { bookingIntentRevision } from "../domain/bookingIntent.js";
import { childDisplayLabel, type ChildProfileDocument } from "../domain/children.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { toClientTripSummary } from "../lib/clientTrips.js";
import { parseCallableData } from "../lib/validation.js";

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
  const schema = z.object({ tripId: z.string(), childId: z.string().optional(),
    seats: z.number().int().positive().default(1), note: z.string().optional() });
  const data = parseCallableData(schema, request.data);
  const bookingRef = firestore.collection("bookings").doc();
  const tripRef = firestore.collection("trips").doc(data.tripId);
  const preflight = await tripRef.get();
  if (!preflight.exists) throw new HttpsError("not-found", "Trip not found.");
  const initial = { id: preflight.id, ...preflight.data() } as Trip;
  requireBookableTrip(initial, uid, data.seats);
  const expectedRevision = intentRevision(initial);

  // Keep this intent outside the retry callback; a retried transaction cannot silently accept new terms.
  const savedTrip = await firestore.runTransaction(async (transaction) => {
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
    return trip;
  });
  return { bookingId: bookingRef.id, status: "requested", trip: toClientTripSummary(savedTrip) };
});
