import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  bookingParticipantUserIds,
  canCancelBooking,
  isCancellableBookingStatus,
  refundStatusForCancellation,
} from "../domain/access.js";
import { childDisplayLabel, type ChildProfileDocument } from "../domain/children.js";
import { roleKeysFromToken } from "../domain/roles.js";
import { isGuardianOfChild } from "../domain/searchAccess.js";
import type { Trip } from "../domain/types.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { notifyUsers } from "../lib/notifications.js";
import { toClientTripSummary } from "../lib/clientTrips.js";
import { toClientBookingRequestSummary } from "../lib/clientBookings.js";
import { parseCallableData } from "../lib/validation.js";

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

export const requestBooking = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "parent");
  const schema = z.object({
    tripId: z.string(),
    childId: z.string().optional(),
    seats: z.number().int().positive().default(1),
    note: z.string().optional(),
  });
  const data = parseCallableData(schema, request.data);
  const bookingRef = firestore.collection("bookings").doc();
  const tripRef = firestore.collection("trips").doc(data.tripId);

  const tripSnap = await tripRef.get();
  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

  const trip = { id: tripSnap.id, ...tripSnap.data() } as Trip;
  if (trip.status !== "published") throw new HttpsError("failed-precondition", "Trip is not available.");
  if (trip.driverUserId === uid) throw new HttpsError("failed-precondition", "Drivers cannot book their own trip.");
  if (trip.seatsAvailable < data.seats) throw new HttpsError("failed-precondition", "Not enough seats available.");

  const child = data.childId ? await loadGuardianChild(uid, data.childId) : undefined;
  const bookingData: Record<string, unknown> = {
    tripId: data.tripId,
    parentUserId: uid,
    requesterUserId: uid,
    driverUserId: trip.driverUserId,
    seats: data.seats,
    status: "requested",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  if (data.childId) {
    bookingData.childId = data.childId;
    bookingData.childLabel = childDisplayLabel(child, data.childId);
  }
  if (data.note) bookingData.note = data.note;

  await bookingRef.set(bookingData);

  return {
    bookingId: bookingRef.id,
    status: "requested",
    trip: toClientTripSummary(trip),
  };
});

async function loadGuardianChild(uid: string, childId: string): Promise<ChildProfileDocument> {
  const childSnap = await firestore.collection("children").doc(childId).get();
  const child = childSnap.data() as ChildProfileDocument | undefined;
  if (!childSnap.exists || !isGuardianOfChild(child, uid)) {
    throw new HttpsError("permission-denied", "Only a guardian can book a trip for this child.");
  }
  return child ?? {};
}

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

    const now = Timestamp.now();
    transaction.update(bookingRef, {
      status: "cancelled",
      cancelReason: data.reason ?? null,
      cancelledAt: now,
      cancelledByUserId: uid,
      refundStatus: refundStatusForCancellation(booking.paymentStatus),
      updatedAt: now,
    });

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
