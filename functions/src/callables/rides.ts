import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { estimateCo2SavedKg } from "../domain/co2.js";
import {
  buildRideCompletionCo2LedgerEntry,
  buildRideCompletionRewardLedgerEntry,
} from "../domain/rideCompletionLedger.js";
import { rewardForCo2Saved } from "../domain/rewards.js";
import { passengersReadyForCompletion } from "../domain/passengerTransition.js";
import { loadAccessibleActiveRide, type RideSessionDocument } from "../lib/activeRideLookup.js";
import { firestore, realtimeDb } from "../lib/firebase.js";
import { hasRole, requireAuth } from "../lib/https.js";
import { toClientRideSnapshot } from "../lib/clientTrips.js";
import { parseCallableData } from "../lib/validation.js";

export { markDropoff, markPickup } from "./ridePassengers.js";
export { startRide } from "./rideStart.js";

export const getActiveRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const activeRide = await loadAccessibleActiveRide(uid, request.auth?.token);
  if (!activeRide) return { ride: null };
  const { id, ride } = activeRide;
  const status = ride.status ?? "active";
  const liveSnap = await realtimeDb.ref(`liveTrips/${id}`).get();
  return { ride: toClientRideSnapshot(id, status, liveSnap.val(), ride) };
});

export const endRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    distanceMeters: z.number().nonnegative().default(0),
    passengersSharing: z.number().int().nonnegative().default(1),
  });
  const data = parseCallableData(schema, request.data);
  const rideRef = firestore.collection("rideSessions").doc(data.rideSessionId);

  const co2SavedKg = estimateCo2SavedKg(data.distanceMeters, data.passengersSharing);
  const rewardCents = rewardForCo2Saved(co2SavedKg);
  const completedAtDate = new Date();
  const completedAt = Timestamp.fromDate(completedAtDate);

  await firestore.runTransaction(async (transaction) => {
    const rideSnap = await transaction.get(rideRef);
    if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");

    const ride = rideSnap.data() as RideSessionDocument;
    if (!hasRole(request.auth?.token, "admin") && ride.driverUserId !== uid) {
      throw new HttpsError("permission-denied", "Only the driver or an admin can end this ride.");
    }
    if (!ride.driverUserId) {
      throw new HttpsError("failed-precondition", "Ride driver is required before completion.");
    }
    if (ride.status !== "active") {
      throw new HttpsError("failed-precondition", "Only an active ride can be ended.");
    }
    if (!passengersReadyForCompletion(ride.bookingIds ?? [], ride.passengers ?? [])) {
      throw new HttpsError("failed-precondition", "All attached passengers must be picked up and dropped off before completion.");
    }
    if (!ride.tripId) throw new HttpsError("failed-precondition", "Ride trip is required before completion.");
    const tripRef = firestore.collection("trips").doc(ride.tripId);
    const tripSnap = await transaction.get(tripRef);
    const trip = tripSnap.data();
    if (!tripSnap.exists || trip?.driverUserId !== ride.driverUserId || !["published", "full"].includes(trip?.status) ||
        (trip?.activeRideSessionId && trip.activeRideSessionId !== data.rideSessionId)) {
      throw new HttpsError("failed-precondition", "Ride trip is not eligible for completion.");
    }
    const approved = await transaction.get(firestore.collection("bookings").where("tripId", "==", ride.tripId)
      .where("status", "==", "approved"));
    if (approved.size !== ride.bookingIds?.length || !approved.docs.every((booking) =>
      ride.bookingIds?.includes(booking.id) && booking.data().driverUserId === ride.driverUserId)) {
      throw new HttpsError("failed-precondition", "Every approved booking must belong to this ride before completion.");
    }

    const ledgerInput = {
      rideSessionId: data.rideSessionId,
      driverUserId: ride.driverUserId,
      distanceMeters: data.distanceMeters,
      passengersSharing: data.passengersSharing,
      co2SavedKg,
      rewardCents,
      createdAt: completedAtDate.toISOString(),
    };
    const co2LedgerEntry = buildRideCompletionCo2LedgerEntry(ledgerInput);
    const rewardLedgerEntry = buildRideCompletionRewardLedgerEntry(ledgerInput);

    transaction.set(
      rideRef,
      {
        status: "completed",
        completedAt,
        co2SavedKg,
        rewardCents,
      },
      { merge: true },
    );
    transaction.update(tripRef, { status: "completed", completedAt, updatedAt: completedAt });
    for (const bookingId of ride.bookingIds ?? []) {
      transaction.set(firestore.collection("bookings").doc(bookingId), {
        status: "completed",
        completedAt,
        updatedAt: completedAt,
      }, { merge: true });
    }
    transaction.create(firestore.collection("co2Ledger").doc(co2LedgerEntry.id), co2LedgerEntry);
    if (rewardLedgerEntry) {
      transaction.create(firestore.collection("rewardLedger").doc(rewardLedgerEntry.id), rewardLedgerEntry);
    }
  });
  await realtimeDb.ref(`liveTrips/${data.rideSessionId}/meta`).update({
    status: "completed",
    completedAt: Date.now(),
  });

  return { rideSessionId: data.rideSessionId, co2SavedKg, rewardCents };
});
