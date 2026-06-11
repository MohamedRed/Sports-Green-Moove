import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { toClientTripSummary } from "../lib/clientTrips.js";

export const requestBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    tripId: z.string(),
    childId: z.string().optional(),
    seats: z.number().int().positive().default(1),
    note: z.string().optional(),
  });
  const data = schema.parse(request.data);
  const bookingRef = firestore.collection("bookings").doc();
  const tripRef = firestore.collection("trips").doc(data.tripId);

  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

  const trip = { id: tripSnap.id, ...tripSnap.data() } as Trip;
  if (trip.status !== "published") throw new HttpsError("failed-precondition", "Trip is not available.");
  if (trip.driverUserId === uid) throw new HttpsError("failed-precondition", "Drivers cannot book their own trip.");
  if (trip.seatsAvailable < data.seats) throw new HttpsError("failed-precondition", "Not enough seats available.");

  await bookingRef.set({
    tripId: data.tripId,
    parentUserId: uid,
    requesterUserId: uid,
    driverUserId: trip.driverUserId,
    childId: data.childId,
    seats: data.seats,
    note: data.note,
    status: "requested",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return {
    bookingId: bookingRef.id,
    status: "requested",
    trip: toClientTripSummary(trip),
  };
});

export const approveBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    bookingId: z.string(),
  });
  const data = schema.parse(request.data);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  await firestore.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as { tripId: string; seats?: number; status?: string };
    if (booking.status !== "requested") throw new HttpsError("failed-precondition", "Booking is not pending.");

    const tripRef = firestore.collection("trips").doc(booking.tripId);
    const tripSnap = await transaction.get(tripRef);
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = tripSnap.data() as Trip;
    if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can approve.");
    if (trip.seatsAvailable < (booking.seats ?? 1)) {
      throw new HttpsError("failed-precondition", "Not enough seats available.");
    }

    transaction.update(bookingRef, {
      status: "approved",
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    transaction.update(tripRef, {
      seatsAvailable: FieldValue.increment(-(booking.seats ?? 1)),
      updatedAt: Timestamp.now(),
    });
  });

  return { bookingId: data.bookingId, status: "approved" };
});
