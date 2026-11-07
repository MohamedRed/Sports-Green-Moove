import { onCall } from "firebase-functions/v2/https";
import { profileCityReadSchema, profileCityWriteSchema } from "../domain/profileCity.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { readProfileCity, writeProfileCity } from "../services/profileCity.js";

export const getProfileCity = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(profileCityReadSchema, request.data);
  return readProfileCity(uid);
});
export const saveProfileCity = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  return writeProfileCity(uid, parseCallableData(profileCityWriteSchema, request.data));
});
