import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import type { Trip } from "../domain/types.js";
import type { RidePassengerDocument, RideSessionDocument } from "../lib/activeRideLookup.js";
import { toClientRideSnapshot } from "../lib/clientTrips.js";
import { firestore, realtimeDb } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

type RideBooking = {
  childId?: string;
  childLabel?: string;
  driverUserId: string;
  parentUserId?: string;
  requesterUserId?: string;
  status?: string;
  tripId?: string;
  paymentStatus?: string;
  agreedPriceCents?: number;
  tripChangeBalanceCents?: number;
};

export const startRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const data = parseCallableData(z.object({ tripId: z.string(), bookingIds: z.array(z.string()).default([]) }), request.data);
  if (new Set(data.bookingIds).size !== data.bookingIds.length) {
    throw new HttpsError("invalid-argument", "Booking IDs must be unique.");
  }
  const tripRef = firestore.collection("trips").doc(data.tripId);
  const newRideRef = firestore.collection("rideSessions").doc();
  const result = await firestore.runTransaction(async (transaction) => {
    const tripSnap = await transaction.get(tripRef);
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = tripSnap.data() as Trip;
    if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can start this ride.");
    if (trip.pendingChangeId) throw new HttpsError("failed-precondition", "A proposed change must be resolved before starting the ride.");
    if (trip.status !== "published" && trip.status !== "full") {
      throw new HttpsError("failed-precondition", "Only an available trip can start a ride.");
    }
    if (trip.activeRideSessionId) {
      const existingSnap = await transaction.get(firestore.collection("rideSessions").doc(trip.activeRideSessionId));
      const ride = existingSnap.data() as RideSessionDocument | undefined;
      if (!ride || !ride.startedAt || ride.status !== "active" || ride.driverUserId !== uid || ride.tripId !== data.tripId ||
          (data.bookingIds.length > 0 && (ride.bookingIds?.length !== data.bookingIds.length ||
            !data.bookingIds.every((id) => ride.bookingIds?.includes(id))))) {
        throw new HttpsError("failed-precondition", "Existing ride does not match this start request.");
      }
      return { id: existingSnap.id, ride };
    }
    const existingRides = await transaction.get(firestore.collection("rideSessions")
      .where("tripId", "==", data.tripId).where("status", "==", "active").limit(1));
    if (!existingRides.empty) {
      throw new HttpsError("failed-precondition", "An existing active ride must be resumed or reconciled before a new start.");
    }
    const approved = await transaction.get(firestore.collection("bookings").where("tripId", "==", data.tripId)
      .where("status", "==", "approved"));
    const bookingIds = approved.docs.map((doc) => doc.id);
    if (data.bookingIds.length > 0 && (data.bookingIds.length !== bookingIds.length ||
        !data.bookingIds.every((id) => bookingIds.includes(id)))) {
      throw new HttpsError("failed-precondition", "Ride must include all approved bookings for this trip.");
    }
    const bookingSnaps = approved.docs;
    const bookings = bookingSnaps.map((snapshot) => {
      if (!snapshot.exists) throw new HttpsError("not-found", "Booking not found.");
      const booking = snapshot.data() as RideBooking;
      if (booking.driverUserId !== uid || booking.tripId !== data.tripId || booking.status !== "approved") {
        throw new HttpsError("failed-precondition", "All bookings must be approved for this driver and trip.");
      }
      if (booking.tripChangeBalanceCents || (trip.appliedChangeId && trip.priceCents > 0 && booking.paymentStatus !== "paid"))
        throw new HttpsError("failed-precondition", "A confirmed trip change still has an unpaid amount or refund to reconcile.");
      return booking;
    });
    const participantUserIds = bookings.map((booking) => booking.parentUserId ?? booking.requesterUserId)
      .filter((id): id is string => Boolean(id));
    const childUserIds = bookings.map((booking) => booking.childId).filter((id): id is string => Boolean(id));
    const passengers = bookings.map((booking, index): RidePassengerDocument => {
      const bookingId = bookingIds[index];
      const childId = booking.childId ?? bookingId;
      return { bookingId, childId, label: booking.childLabel ?? `Enfant ${childId.slice(-4).toUpperCase()}`,
        parentUserId: booking.parentUserId ?? booking.requesterUserId, pickupStatus: "pending", dropoffStatus: "pending" };
    });
    const now = Timestamp.now();
    const ride = { tripId: data.tripId, bookingIds, driverUserId: uid, participantUserIds,
      childUserIds, passengers, status: "active", startedAt: now, createdAt: now };
    transaction.create(newRideRef, ride);
    transaction.update(tripRef, { activeRideSessionId: newRideRef.id, updatedAt: now });
    return { id: newRideRef.id, ride };
  });
  await realtimeDb.ref(`liveTrips/${result.id}/meta`).update({
    tripId: data.tripId, driverUserId: uid, status: "active", startedAt: result.ride.startedAt?.toMillis(),
    participantUserIds: Object.fromEntries((result.ride.participantUserIds ?? []).map((id) => [id, true])),
    childUserIds: Object.fromEntries((result.ride.childUserIds ?? []).map((id) => [id, true])),
  });
  return { ride: toClientRideSnapshot(result.id, "active", null, result.ride) };
});
