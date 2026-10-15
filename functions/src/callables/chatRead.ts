import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatNotificationId } from "../domain/chatDelivery.js";
import { chatDocumentIdSchema, chatReferenceSchema, requireChatParticipant } from "../lib/chatConversation.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

export const getChatConversation = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const source = parseCallableData(chatReferenceSchema, request.data);
  const participantIds = await requireChatParticipant(uid, source);
  const profiles = await firestore.getAll(...participantIds.map((id) => firestore.collection("users").doc(id)));
  return { conversation: { ...source, currentUserId: uid,
    title: source.sourceType === "booking" ? "Conversation réservation" : "Conversation course",
    participants: profiles.map((profile) => ({ userId: profile.id,
      displayName: typeof profile.data()?.displayName === "string" ? profile.data()!.displayName.trim() || null : null })),
  } };
});

const readSchema = chatReferenceSchema.extend({
  messageIds: z.array(chatDocumentIdSchema).min(1).max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Message IDs must be unique."),
});

export const markChatMessagesRead = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(readSchema, request.data);
  await firestore.runTransaction(async (transaction) => {
    await requireChatParticipant(uid, data, transaction);
    const messages = await transaction.getAll(...data.messageIds.map((id) => firestore.collection("messages").doc(id)));
    const notes = await transaction.getAll(...data.messageIds.map((id) => firestore.collection("notifications").doc(chatNotificationId(id, uid))));
    for (const message of messages) {
      if (!message.exists) throw new HttpsError("not-found", "Message not found.");
      const value = message.data() ?? {};
      if (value.sourceType !== data.sourceType || value.sourceId !== data.sourceId) {
        throw new HttpsError("failed-precondition", "Message does not belong to this conversation.");
      }
      if (!Array.isArray(value.participantUserIds) || !value.participantUserIds.includes(uid)) {
        throw new HttpsError("permission-denied", "Message is not accessible to this user.");
      }
    }
    const now = Timestamp.now();
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (!message.data()?.readByUserIds?.includes(uid)) {
        transaction.update(message.ref, { readByUserIds: FieldValue.arrayUnion(uid) });
      }
      const note = notes[index];
      if (note.exists) {
        const value = note.data();
        if (value?.userId !== uid || value.messageId !== message.id || value.sourceId !== data.sourceId ||
            value.sourceType !== data.sourceType || value.type !== "chatMessage") {
          throw new HttpsError("failed-precondition", "Message notification metadata is inconsistent.");
        }
        if (value.read !== true) transaction.update(note.ref, { read: true, readAt: now });
      }
    }
  });
  return { readMessageIds: data.messageIds };
});
