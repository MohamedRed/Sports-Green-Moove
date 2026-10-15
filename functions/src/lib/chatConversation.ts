import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { bookingParticipantUserIds, rideParticipantUserIds } from "../domain/access.js";
import { firestore } from "./firebase.js";

export const chatDocumentIdSchema = z.string().min(1).max(256).regex(/^[^/]+$/)
  .refine((id) => id !== "." && id !== ".." && !/^__.*__$/.test(id), "Invalid document ID.");
export const chatReferenceSchema = z.object({ sourceType: z.enum(["booking", "rideSession"]), sourceId: chatDocumentIdSchema });
export type ChatReference = z.infer<typeof chatReferenceSchema>;

export async function requireChatParticipant(uid: string, source: ChatReference, transaction?: Transaction) {
  const ref = firestore.collection(source.sourceType === "booking" ? "bookings" : "rideSessions").doc(source.sourceId);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Conversation source not found.");
  const record = snapshot.data() ?? {};
  const participantUserIds = source.sourceType === "booking"
    ? bookingParticipantUserIds(record) : rideParticipantUserIds(record);
  if (!participantUserIds.includes(uid)) throw new HttpsError("permission-denied", "Only conversation participants can access messages.");
  if (participantUserIds.length > 100) throw new HttpsError("resource-exhausted", "Conversation participant limit exceeded.");
  return participantUserIds;
}
