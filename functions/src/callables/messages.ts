import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { bookingParticipantUserIds, rideParticipantUserIds } from "../domain/access.js";
import { buildInboxChats, buildInboxReviewPrompts, mapInboxNotifications, type InboxDocument } from "../domain/inbox.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { notifyUsers } from "../lib/notifications.js";
import { parseCallableData } from "../lib/validation.js";

type BookingConversation = {
  driverUserId?: string;
  parentUserId?: string;
  requesterUserId?: string;
};

type RideConversation = {
  driverUserId?: string;
  participantUserIds?: string[];
};

const sendMessageSchema = z.object({
  bookingId: z.string().optional(),
  rideSessionId: z.string().optional(),
  body: z.string().trim().min(1).max(1000),
}).refine((data) => Boolean(data.bookingId) !== Boolean(data.rideSessionId), {
  message: "Provide exactly one bookingId or rideSessionId.",
});

async function conversationParticipants(data: z.infer<typeof sendMessageSchema>): Promise<string[]> {
  if (data.bookingId) {
    const snap = await firestore.collection("bookings").doc(data.bookingId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() as BookingConversation;
    return bookingParticipantUserIds(booking);
  }

  const snap = await firestore.collection("rideSessions").doc(data.rideSessionId ?? "").get();
  if (!snap.exists) throw new HttpsError("not-found", "Ride session not found.");
  const ride = snap.data() as RideConversation;
  return rideParticipantUserIds(ride);
}

export const sendChatMessage = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(sendMessageSchema, request.data);
  const participantUserIds = [...new Set(await conversationParticipants(data))];
  if (!participantUserIds.includes(uid)) {
    throw new HttpsError("permission-denied", "Only conversation participants can send messages.");
  }

  const ref = firestore.collection("messages").doc();
  const sourceType = data.bookingId ? "booking" : "rideSession";
  const sourceId = data.bookingId ?? data.rideSessionId;
  if (!sourceId) throw new HttpsError("invalid-argument", "Conversation source is required.");
  await ref.set({
    senderUserId: uid,
    participantUserIds,
    sourceType,
    sourceId,
    body: data.body,
    createdAt: Timestamp.now(),
  });

  await notifyUsers(participantUserIds.filter((userId) => userId !== uid), {
    type: "chatMessage",
    title: "Nouveau message",
    body: data.body,
    sourceId,
  });

  return { messageId: ref.id, participantUserIds };
});

export const getInbox = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const [notifications, messages, participantRides, driverRides, ratings] = await Promise.all([
    firestore.collection("notifications").where("userId", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
    firestore.collection("messages").where("participantUserIds", "array-contains", uid).orderBy("createdAt", "desc").limit(50).get(),
    firestore.collection("rideSessions").where("participantUserIds", "array-contains", uid).limit(30).get(),
    firestore.collection("rideSessions").where("driverUserId", "==", uid).limit(30).get(),
    firestore.collection("ratings").where("authorUserId", "==", uid).limit(100).get(),
  ]);

  const rideDocs = uniqueDocuments([...participantRides.docs, ...driverRides.docs]).map(toInboxDocument);
  const authoredRatingIds = new Set(ratings.docs.map((doc) => doc.id));

  return {
    inbox: {
      notifications: mapInboxNotifications(notifications.docs.map(toInboxDocument)),
      chats: buildInboxChats(messages.docs.map(toInboxDocument), uid),
      reviews: buildInboxReviewPrompts(rideDocs, authoredRatingIds, uid),
    },
  };
});

function toInboxDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): InboxDocument {
  return { id: doc.id, data: doc.data() };
}

function uniqueDocuments(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): FirebaseFirestore.QueryDocumentSnapshot[] {
  return [...new Map(docs.map((doc) => [doc.id, doc])).values()];
}
