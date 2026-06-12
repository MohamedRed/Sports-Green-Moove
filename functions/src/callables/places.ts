import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireAuth } from "../lib/https.js";
import { GooglePlacesProvider } from "../services/googlePlaces.js";

const suggestPlacesSchema = z.object({
  input: z.string().trim().min(3).max(120),
});

const resolvePlaceSchema = z.object({
  placeId: z.string().trim().min(1).max(256),
});

export const suggestPlaces = onCall(async (request) => {
  requireAuth(request.auth?.uid);
  const { input } = suggestPlacesSchema.parse(request.data ?? {});
  const suggestions = await new GooglePlacesProvider().suggestPlaces(input);
  return { suggestions };
});

export const resolvePlace = onCall(async (request) => {
  requireAuth(request.auth?.uid);
  const { placeId } = resolvePlaceSchema.parse(request.data ?? {});
  const place = await new GooglePlacesProvider().resolvePlace(placeId);
  return { place };
});
