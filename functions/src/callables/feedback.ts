import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { rideParticipantUserIds } from "../domain/access.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

type RideSessionDocument = {
  driverUserId?: string;
  participantUserIds?: string[];
  status?: string;
};

export const submitRating = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    rideSessionId: z.string(),
    ratedUserId: z.string(),
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional(),
  });
  const data = schema.parse(request.data);
  const rideSnap = await firestore.collection("rideSessions").doc(data.rideSessionId).get();
  if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");

  const ride = rideSnap.data() as RideSessionDocument;
  if (ride.status !== "completed") {
    throw new HttpsError("failed-precondition", "Ratings can only be submitted after completed rides.");
  }

  const participants = rideParticipantUserIds(ride);
  if (!participants.includes(uid) || !participants.includes(data.ratedUserId)) {
    throw new HttpsError("permission-denied", "Only ride participants can rate each other.");
  }
  if (data.ratedUserId === uid) {
    throw new HttpsError("failed-precondition", "Users cannot rate themselves.");
  }

  const ratingRef = firestore.collection("ratings").doc(`${data.rideSessionId}_${uid}_${data.ratedUserId}`);
  if ((await ratingRef.get()).exists) {
    throw new HttpsError("already-exists", "This rating was already submitted.");
  }

  await ratingRef.create({
    rideSessionId: data.rideSessionId,
    authorUserId: uid,
    ratedUserId: data.ratedUserId,
    score: data.score,
    comment: data.comment ?? null,
    createdAt: Timestamp.now(),
  });

  return { ratingId: ratingRef.id };
});

export const createReport = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const schema = z.object({
    subjectType: z.enum(["booking", "rideSession", "message", "user", "other"]),
    subjectId: z.string().optional(),
    reason: z.string().trim().min(2).max(120),
    description: z.string().trim().min(5).max(2000),
    emergency: z.boolean().default(false),
  });
  const data = schema.parse(request.data);
  const ref = firestore.collection("reports").doc();

  await ref.set({
    ...data,
    reporterUserId: uid,
    status: "open",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return { reportId: ref.id, status: "open" };
});
