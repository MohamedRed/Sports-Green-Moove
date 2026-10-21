import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  bookingParticipantUserIds,
  canCancelBooking,
  isCancellableBookingStatus,
  refundStatusForCancellation,
} from "../domain/access.js";
import { roleKeysFromToken } from "../domain/roles.js";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { notifyUsers } from "../lib/notifications.js";
import { toClientBookingRequestSummary } from "../lib/clientBookings.js";
import { parseCallableData } from "../lib/validation.js";
import { cancellationBalance } from "../services/tripChangeBalanceClosure.js";
export { requestBooking } from "./bookingRequests.js";

type BookingDocument = {
  id?: string;
  tripId: string;
  parentUserId?: string;
  requesterUserId?: string;
  driverUserId: string;
  seats?: number;
  status?: string;
  paymentStatus?: string;
  childId?: string;
  childLabel?: string;
  note?: string;
};

const driverQueueStatuses = new Set(["requested", "approved"]);

export const listDriverBookingRequests = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");

  const snapshot = await firestore
    .collection("bookings")
    .where("driverUserId", "==", uid)
    .limit(100)
    .get();

  const bookings = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as BookingDocument & { id: string })
    .filter((booking) => driverQueueStatuses.has(booking.status ?? "requested"));
  const tripIds = [...new Set(bookings.map((booking) => booking.tripId).filter(Boolean))];
  const tripSnaps = await Promise.all(tripIds.map((tripId) => firestore.collection("trips").doc(tripId).get()));
  const trips = new Map<string, Trip>();
  for (const snap of tripSnaps) {
    if (snap.exists) trips.set(snap.id, { id: snap.id, ...snap.data() } as Trip);
  }

  return {
    bookings: bookings.flatMap((booking) => {
      const trip = trips.get(booking.tripId);
      return trip ? [toClientBookingRequestSummary(booking, trip)] : [];
    }),
  };
});

export const approveBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    bookingId: z.string(),
  });
  const data = parseCallableData(schema, request.data);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  const approval = await firestore.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = bookingSnap.data() as BookingDocument;
    if (booking.status !== "requested") throw new HttpsError("failed-precondition", "Booking is not pending.");

    const tripRef = firestore.collection("trips").doc(booking.tripId);
    const tripSnap = await transaction.get(tripRef);
    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    const trip = tripSnap.data() as Trip;
    if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can approve.");
    if (trip.status !== "published" || trip.activeRideSessionId || trip.pendingChangeId) {
      throw new HttpsError("failed-precondition", "Bookings cannot be approved after a trip starts or closes.");
    }
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

    return {
      parentUserId: booking.parentUserId ?? booking.requesterUserId,
      tripTitle: trip.title ?? trip.category ?? "Trajet",
    };
  });

  await notifyUsers(approval.parentUserId ? [approval.parentUserId] : [], {
    type: "bookingApproved",
    title: "Réservation approuvée",
    body: `${approval.tripTitle} est approuvé par le conducteur.`,
    sourceId: data.bookingId,
  });

  return { bookingId: data.bookingId, status: "approved" };
});

export const cancelBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    bookingId: z.string(),
    reason: z.string().max(300).optional(),
  });
  const data = parseCallableData(schema, request.data);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  const notifyUserIds = await firestore.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");

    const booking = bookingSnap.data() as BookingDocument;
    if (!canCancelBooking(uid, roleKeysFromToken(request.auth?.token), booking)) {
      throw new HttpsError("permission-denied", "Only the parent, driver, or an admin can cancel this booking.");
    }

    if (!isCancellableBookingStatus(booking.status)) {
      throw new HttpsError("failed-precondition", "Only requested or approved bookings can be cancelled.");
    }
    if (booking.status === "approved") {
      const tripSnap = await transaction.get(firestore.collection("trips").doc(booking.tripId));
      if (!tripSnap.exists) throw new HttpsError("failed-precondition", "Booking trip is missing.");
      const activeRideId = tripSnap.data()?.activeRideSessionId;
      if (activeRideId) {
        const ride = await transaction.get(firestore.collection("rideSessions").doc(activeRideId));
        if (!ride.exists || !Array.isArray(ride.data()?.bookingIds) || ride.data()?.bookingIds.includes(data.bookingId)) {
          throw new HttpsError("failed-precondition", "An active ride passenger cannot cancel this booking.");
        }
      }
    }

    const balance = await cancellationBalance(transaction, data.bookingId, booking);
    const now = Timestamp.now();
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelReason: data.reason ?? null,
      cancelledAt: now,
      cancelledByUserId: uid,
      refundStatus: refundStatusForCancellation(booking.paymentStatus),
      ...(balance ? { tripChangeBalanceCents: 0 } : {}),
      updatedAt: now,
    });

    if (balance) transaction.update(balance, { state: "cancelled", cancelledAt: now, updatedAt: now });

    if (booking.status === "approved") {
      transaction.update(firestore.collection("trips").doc(booking.tripId), {
        seatsAvailable: FieldValue.increment(booking.seats ?? 1),
        updatedAt: now,
      });
    }

    return bookingParticipantUserIds(booking).filter((userId) => userId !== uid);
  });

  await notifyUsers(notifyUserIds, {
    type: "bookingCancelled",
    title: "Réservation annulée",
    body: data.reason ?? "Une réservation a été annulée.",
    sourceId: data.bookingId,
  });

  return { bookingId: data.bookingId, status: "cancelled" };
});
