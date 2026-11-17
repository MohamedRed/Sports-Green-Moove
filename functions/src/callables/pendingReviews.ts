import { onCall } from "firebase-functions/v2/https";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { pendingReviewInput, pendingReviewPage } from "../services/pendingReviews.js";

export const getPendingReviews = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(pendingReviewInput, request.data);
  return pendingReviewPage(uid, input.cursor);
});
