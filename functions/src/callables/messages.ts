import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatMessageId, chatNotificationId, sameChatRequest } from "../domain/chatDelivery.js";
import { chatDocumentIdSchema, requireChatParticipant } from "../lib/chatConversation.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

export { getInbox } from "./inbox.js";
export { getChatConversation, markChatMessagesRead } from "./chatRead.js";

const sendMessageSchema = z.object({
  bookingId: chatDocumentIdSchema.optional(),
  rideSessionId: chatDocumentIdSchema.optional(),
  body: z.string().trim().min(1).max(1000),
  clientMessageId: z.string().uuid().transform((id) => id.toLowerCase()).optional(),
}).refine((data) => Boolean(data.bookingId) !== Boolean(data.rideSessionId), {
  message: "Provide exactly one bookingId or rideSessionId.",
});

export const sendChatMessage = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(sendMessageSchema, request.data);
  const sourceType = data.bookingId ? "booking" as const : "rideSession" as const;
  const sourceId = (data.bookingId ?? data.rideSessionId)!;
  const ref = data.clientMessageId
    ? firestore.collection("messages").doc(chatMessageId(uid, data.clientMessageId))
    : firestore.collection("messages").doc();
  return firestore.runTransaction(async (transaction) => {
    const participantUserIds = await requireChatParticipant(uid, { sourceType, sourceId }, transaction);
    const existing = await transaction.get(ref);
    const content = { senderUserId: uid, sourceType, sourceId, body: data.body };
    if (existing.exists) {
      if (!sameChatRequest(existing.data() ?? {}, content)) {
        throw new HttpsError("already-exists", "This send request ID was already used for a different message.");
      }
      return { messageId: ref.id, participantUserIds, reused: true };
    }
    const createdAt = Timestamp.now();
    transaction.create(ref, { ...content, participantUserIds, createdAt, readByUserIds: [uid],
      ...(data.clientMessageId ? { clientMessageId: data.clientMessageId } : {}) });
    for (const userId of participantUserIds.filter((id) => id !== uid)) {
      transaction.create(firestore.collection("notifications").doc(chatNotificationId(ref.id, userId)), {
        type: "chatMessage", title: "Nouveau message", body: data.body, sourceType, sourceId,
        messageId: ref.id, userId, read: false, createdAt,
      });
    }
    return { messageId: ref.id, participantUserIds, reused: false };
  });
});
