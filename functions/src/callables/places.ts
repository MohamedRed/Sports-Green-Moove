import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth } from "../lib/https.js";
import { googleMapsApiKeySecret } from "../lib/providerSecrets.js";
import { parseCallableData } from "../lib/validation.js";
import { GooglePlacesProvider } from "../services/googlePlaces.js";

const suggestPlacesSchema = z.object({
  input: z.string().trim().min(3).max(120),
});

const resolvePlaceSchema = z.object({
  placeId: z.string().trim().min(1).max(256),
});

export const suggestPlaces = onCall({ secrets: [googleMapsApiKeySecret] }, async (request) => {
  requireAuth(request.auth?.uid);
  const { input } = parseCallableData(suggestPlacesSchema, request.data ?? {});
  const suggestions = await new GooglePlacesProvider({ apiKey: googleMapsApiKeySecret.value() }).suggestPlaces(input);
  return { suggestions };
});

export const resolvePlace = onCall({ secrets: [googleMapsApiKeySecret] }, async (request) => {
  requireAuth(request.auth?.uid);
  const { placeId } = parseCallableData(resolvePlaceSchema, request.data ?? {});
  const place = await new GooglePlacesProvider({ apiKey: googleMapsApiKeySecret.value() }).resolvePlace(placeId);
  return { place };
});
