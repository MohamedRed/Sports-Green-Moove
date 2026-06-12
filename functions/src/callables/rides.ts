import { Timestamp } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { estimateCo2SavedKg } from "../domain/co2.js";
import { rewardForCo2Saved } from "../domain/rewards.js";
import type { Trip } from "../domain/types.js";
import { firestore, realtimeDb } from "../lib/firebase.js";
import { hasRole, requireAuth, requireRole } from "../lib/https.js";
import { notifyUsers } from "../lib/notifications.js";
import { toClientRideSnapshot } from "../lib/clientTrips.js";

type BookingDocument = {
  driverUserId: string;
  parentUserId?: string;
  requesterUserId?: string;
  status?: string;
  tripId?: string;
};

type RideSessionDocument = {
  bookingIds?: string[];
  driverUserId?: string;
  participantUserIds?: string[];
  status?: string;
};

export const startRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    tripId: z.string(),
    bookingIds: z.array(z.string()).default([]),
  });
  const data = schema.parse(request.data);
  const tripSnap = await firestore.collection("trips").doc(data.tripId).get();
  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

  const trip = tripSnap.data() as Trip;
  if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can start this ride.");

  const bookingSnaps = await Promise.all(
    data.bookingIds.map((bookingId) => firestore.collection("bookings").doc(bookingId).get()),
  );
  const bookings = bookingSnaps.map((snap, index) => {
    if (!snap.exists) throw new HttpsError("not-found", `Booking ${data.bookingIds[index]} not found.`);
    return snap.data() as BookingDocument;
  });
  for (const booking of bookings) {
    if (booking.driverUserId !== uid || booking.tripId !== data.tripId) {
      throw new HttpsError("failed-precondition", "All bookings must belong to this driver and trip.");
    }
    if (booking.status !== "approved") {
      throw new HttpsError("failed-precondition", "Only approved bookings can be attached to a ride.");
    }
  }
  const participantUserIds = bookings
    .map((booking) => booking.parentUserId ?? booking.requesterUserId)
    .filter((userId): userId is string => Boolean(userId));

  const ref = firestore.collection("rideSessions").doc();
  await ref.set({
    tripId: data.tripId,
    bookingIds: data.bookingIds,
    driverUserId: uid,
    participantUserIds,
    status: "active",
    startedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  });

  await realtimeDb.ref(`liveTrips/${ref.id}/meta`).set({
    tripId: data.tripId,
    driverUserId: uid,
    participantUserIds: participantMap(participantUserIds),
    status: "active",
    startedAt: Date.now(),
  });

  return { ride: toClientRideSnapshot(ref.id, "active") };
});

async function markPassengerStatus(
  request: CallableRequest,
  event: "pickup" | "dropoff",
) {
  const uid = requireAuth(request.auth?.uid);
  requireRole(request.auth?.token, "driver");
  const schema = z.object({
    rideSessionId: z.string(),
    bookingId: z.string(),
    childId: z.string(),
    note: z.string().max(300).optional(),
  });
  const data = schema.parse(request.data);
  const rideRef = firestore.collection("rideSessions").doc(data.rideSessionId);
  const bookingRef = firestore.collection("bookings").doc(data.bookingId);

  const parentUserId = await firestore.runTransaction(async (transaction) => {
    const [rideSnap, bookingSnap] = await Promise.all([
      transaction.get(rideRef),
      transaction.get(bookingRef),
    ]);
    if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");

    const ride = rideSnap.data() as RideSessionDocument;
    const booking = bookingSnap.data() as BookingDocument;
    if (ride.driverUserId !== uid || booking.driverUserId !== uid) {
      throw new HttpsError("permission-denied", "Only the ride driver can update passenger status.");
    }
    if (booking.status !== "approved") {
      throw new HttpsError("failed-precondition", "Only approved bookings can receive passenger status updates.");
    }
    if (ride.status !== "active") {
      throw new HttpsError("failed-precondition", "Passenger status can only be updated during an active ride.");
    }
    if (ride.bookingIds?.length && !ride.bookingIds.includes(data.bookingId)) {
      throw new HttpsError("failed-precondition", "Booking is not attached to this ride session.");
    }

    const now = Timestamp.now();
    const statusUpdate =
      event === "pickup"
        ? { pickupStatus: "pickedUp", pickedUpAt: now, pickupNote: data.note ?? null }
        : { dropoffStatus: "droppedOff", droppedOffAt: now, dropoffNote: data.note ?? null };

    transaction.set(rideRef, {
      passengerStatuses: {
        [data.childId]: {
          ...statusUpdate,
          bookingId: data.bookingId,
          updatedByUserId: uid,
          updatedAt: now,
        },
      },
      updatedAt: now,
    }, { merge: true });
    transaction.set(bookingRef, {
      ...statusUpdate,
      updatedAt: now,
    }, { merge: true });

    return booking.parentUserId ?? booking.requesterUserId;
  });

  await notifyUsers(parentUserId ? [parentUserId] : [], {
    type: event === "pickup" ? "passengerPickedUp" : "passengerDroppedOff",
    title: event === "pickup" ? "Enfant récupéré" : "Enfant déposé",
    body: event === "pickup" ? "Le conducteur a confirmé le pickup." : "Le conducteur a confirmé le dropoff.",
    sourceId: data.rideSessionId,
  });

  return { rideSessionId: data.rideSessionId, bookingId: data.bookingId, childId: data.childId, status: event };
}

export const markPickup = onCall((request) => markPassengerStatus(request, "pickup"));

export const markDropoff = onCall((request) => markPassengerStatus(request, "dropoff"));

export const getActiveRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const snapshot = await firestore
    .collection("rideSessions")
    .where("driverUserId", "==", uid)
    .where("status", "==", "active")
    .orderBy("startedAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) return { ride: null };
  const doc = snapshot.docs[0];
  const status = (doc.data().status as string | undefined) ?? "active";
  return { ride: toClientRideSnapshot(doc.id, status) };
});

export const endRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    distanceMeters: z.number().nonnegative().default(0),
    passengersSharing: z.number().int().nonnegative().default(1),
  });
  const data = schema.parse(request.data);
  const rideRef = firestore.collection("rideSessions").doc(data.rideSessionId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");

  const ride = rideSnap.data() as { driverUserId?: string };
  if (!hasRole(request.auth?.token, "admin") && ride.driverUserId !== uid) {
    throw new HttpsError("permission-denied", "Only the driver or an admin can end this ride.");
  }

  const co2SavedKg = estimateCo2SavedKg(data.distanceMeters, data.passengersSharing);
  const rewardCents = rewardForCo2Saved(co2SavedKg);

  await rideRef.set(
    {
      status: "completed",
      completedAt: Timestamp.now(),
      co2SavedKg,
      rewardCents,
    },
    { merge: true },
  );
  await realtimeDb.ref(`liveTrips/${data.rideSessionId}/meta`).update({
    status: "completed",
    completedAt: Date.now(),
  });

  return { rideSessionId: data.rideSessionId, co2SavedKg, rewardCents };
});

function participantMap(userIds: readonly string[]): Record<string, true> {
  return Object.fromEntries([...new Set(userIds)].map((userId) => [userId, true]));
}
