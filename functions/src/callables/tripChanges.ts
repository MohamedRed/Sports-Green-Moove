import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { tripChangeDecisionSchema, tripChangeProposalSchema, tripChangeReferenceSchema,
  tripChangeWithdrawalSchema } from "../domain/tripChanges.js";
import { requireAuth, requireRole } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { previewTripChange, proposeTripChange, respondTripChange, reviewTripChange, withdrawTripChange } from "../services/tripChanges.js";
import { applyTripChangeSchema, quoteTripChangeSchema } from "../domain/tripChangeApplication.js";
import { applyConfirmedTripChange, quoteTripChangeApplication } from "../services/tripChangeApplication.js";
import { GoogleRoutesProvider } from "../services/googleRoutes.js";
import { googleMapsApiKeySecret } from "../lib/providerSecrets.js";

export const getTripChangePreview = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "driver");
  const data = parseCallableData(z.object({ tripId: chatDocumentIdSchema }).strict(), request.data);
  return previewTripChange(data.tripId, uid);
});
export const proposeTripChanges = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "driver");
  return proposeTripChange(parseCallableData(tripChangeProposalSchema, request.data), uid);
});
export const getTripChangeReview = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(tripChangeReferenceSchema, request.data);
  return reviewTripChange(data.tripId, data.proposalId, uid);
});
export const respondToTripChanges = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "parent");
  return respondTripChange(parseCallableData(tripChangeDecisionSchema, request.data), uid);
});
export const withdrawTripChanges = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "driver");
  return withdrawTripChange(parseCallableData(tripChangeWithdrawalSchema, request.data), uid);
});

export const getTripChangeApplicationQuote = onCall({ secrets: [googleMapsApiKeySecret] }, async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "driver");
  return quoteTripChangeApplication(parseCallableData(quoteTripChangeSchema, request.data), uid,
    new GoogleRoutesProvider({ apiKey: googleMapsApiKeySecret.value() }));
});
export const applyTripChanges = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid); requireRole(request.auth?.token, "driver");
  return applyConfirmedTripChange(parseCallableData(applyTripChangeSchema, request.data), uid);
});
