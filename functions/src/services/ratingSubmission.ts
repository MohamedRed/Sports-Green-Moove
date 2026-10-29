import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { rideParticipantUserIds } from "../domain/access.js";
import { matchesRatingSubmission, type RatingSubmission } from "../domain/ratingSubmission.js";
import { firestore } from "../lib/firebase.js";

type RideSessionDocument = { driverUserId?: string; participantUserIds?: string[]; childUserIds?: string[]; status?: string };

export async function submitRideRating(uid: string, data: RatingSubmission) {
  const rideRef = firestore.collection("rideSessions").doc(data.rideSessionId);
  const ratingRef = firestore.collection("ratings").doc(`${data.rideSessionId}_${uid}_${data.ratedUserId}`);
  await firestore.runTransaction(async transaction => {
    const [rideSnap, ratingSnap] = await transaction.getAll(rideRef, ratingRef);
    if (!rideSnap.exists) throw new HttpsError("not-found", "Ride session not found.");
    const ride = rideSnap.data() as RideSessionDocument;
    if (ride.status !== "completed")
      throw new HttpsError("failed-precondition", "Ratings can only be submitted after completed rides.");
    const participants = rideParticipantUserIds(ride);
    if (!participants.includes(uid) || !participants.includes(data.ratedUserId))
      throw new HttpsError("permission-denied", "Only ride participants can rate each other.");
    if (data.ratedUserId === uid) throw new HttpsError("failed-precondition", "Users cannot rate themselves.");
    if (ratingSnap.exists) {
      if (!matchesRatingSubmission(ratingSnap.data()!, uid, data))
        throw new HttpsError("already-exists", "This rating was already submitted.");
      return;
    }
    transaction.create(ratingRef, { ...data, authorUserId: uid, comment: data.comment ?? null, createdAt: Timestamp.now() });
  });
  return { ratingId: ratingRef.id };
}
