import { onCall } from "firebase-functions/v2/https";
import { emergencyReadSchema, emergencyWriteSchema } from "../domain/emergencyContact.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { readEmergencyContact, writeEmergencyContact } from "../services/emergencyContact.js";

export const getEmergencyContact = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(emergencyReadSchema, request.data);
  return readEmergencyContact(uid, request.auth?.token, input.target);
});
export const saveEmergencyContact = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(emergencyWriteSchema, request.data);
  return writeEmergencyContact(uid, request.auth?.token, input);
});
