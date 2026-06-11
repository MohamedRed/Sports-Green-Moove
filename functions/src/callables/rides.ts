import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { estimateCo2SavedKg } from "../domain/co2.js";
import { rewardForCo2Saved } from "../domain/rewards.js";
import type { Trip } from "../domain/types.js";
import { firestore, realtimeDb } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { toClientRideSnapshot } from "../lib/clientTrips.js";

export const startRide = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    tripId: z.string(),
    bookingIds: z.array(z.string()).default([]),
  });
  const data = schema.parse(request.data);
  const tripSnap = await firestore.collection("trips").doc(data.tripId).get();
  if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

  const trip = tripSnap.data() as Trip;
  if (trip.driverUserId !== uid) throw new HttpsError("permission-denied", "Only the driver can start this ride.");

  const ref = firestore.collection("rideSessions").doc();
  await ref.set({
    tripId: data.tripId,
    bookingIds: data.bookingIds,
    driverUserId: uid,
    status: "active",
    startedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  });

  await realtimeDb.ref(`liveTrips/${ref.id}/meta`).set({
    tripId: data.tripId,
    status: "active",
    startedAt: Date.now(),
  });

  return { ride: toClientRideSnapshot(ref.id, "active") };
});

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
  requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    distanceMeters: z.number().nonnegative().default(0),
    passengersSharing: z.number().int().nonnegative().default(1),
  });
  const data = schema.parse(request.data);
  const co2SavedKg = estimateCo2SavedKg(data.distanceMeters, data.passengersSharing);
  const rewardCents = rewardForCo2Saved(co2SavedKg);

  await firestore.collection("rideSessions").doc(data.rideSessionId).set(
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
