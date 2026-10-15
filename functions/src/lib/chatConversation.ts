import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { bookingParticipantUserIds, rideParticipantUserIds } from "../domain/access.js";
import { chatDocumentIdSchema, type ChatReference } from "../domain/chatReference.js";
import { firestore } from "./firestore.js";

export { chatDocumentIdSchema, chatReferenceSchema, type ChatReference } from "../domain/chatReference.js";

export async function authorizedChatSource(uid: string, source: ChatReference, transaction?: Transaction) {
  const ref = firestore.collection(source.sourceType === "booking" ? "bookings" : "rideSessions").doc(source.sourceId);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Conversation source not found.");
  const record = snapshot.data() ?? {};
  if (source.sourceType === "rideSession" && [record.participantUserIds, record.childUserIds]
    .some((ids) => ids !== undefined && !Array.isArray(ids))) {
    throw new HttpsError("failed-precondition", "Conversation participant metadata requires repair.");
  }
  const participantUserIds = source.sourceType === "booking"
    ? bookingParticipantUserIds(record) : rideParticipantUserIds(record);
  if (participantUserIds.some((id) => !chatDocumentIdSchema.safeParse(id).success)) {
    throw new HttpsError("failed-precondition", "Conversation participant identity requires repair.");
  }
  if (!participantUserIds.includes(uid)) throw new HttpsError("permission-denied", "Only conversation participants can access messages.");
  if (participantUserIds.length > 100) throw new HttpsError("resource-exhausted", "Conversation participant limit exceeded.");
  return { participantUserIds, record };
}

export async function requireChatParticipant(uid: string, source: ChatReference, transaction?: Transaction) {
  return (await authorizedChatSource(uid, source, transaction)).participantUserIds;
}
