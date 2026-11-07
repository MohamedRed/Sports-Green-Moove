import { AggregateField } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { receivedRatingsReadSchema, receivedRatingSummary } from "../domain/receivedRatings.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

export const getReceivedRatingSummary = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(receivedRatingsReadSchema, request.data);
  const snapshot = await firestore.collection("ratings").where("ratedUserId", "==", uid)
    .aggregate({ count: AggregateField.count(), average: AggregateField.average("score") }).get();
  const { count, average } = snapshot.data();
  return receivedRatingSummary(uid, count, average);
});
