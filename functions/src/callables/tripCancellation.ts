import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { hasRole, requireAnyRole, requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { cancellationRequestSchema, cancelPublishedTrip, previewTripCancellation } from "../services/tripCancellation.js";

export const getTripCancellation = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAnyRole(request.auth?.token, ["driver", "admin"]);
  const data = parseCallableData(z.object({ tripId: chatDocumentIdSchema }).strict(), request.data);
  return previewTripCancellation(data.tripId, uid, hasRole(request.auth?.token, "admin"));
});

export const cancelTrip = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  requireAnyRole(request.auth?.token, ["driver", "admin"]);
  return cancelPublishedTrip(parseCallableData(cancellationRequestSchema, request.data), uid, hasRole(request.auth?.token, "admin"));
});
