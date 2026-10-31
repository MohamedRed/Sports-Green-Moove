import { onCall } from "firebase-functions/v2/https";
import { buildInboxChats, buildInboxReviewPrompts, mapInboxNotifications, type InboxDocument } from "../domain/inbox.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

export const getInbox = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const [notifications, messages, participantRides, driverRides, ratings] = await Promise.all([
    firestore.collection("notifications").where("userId", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
    firestore.collection("messages").where("participantUserIds", "array-contains", uid).orderBy("createdAt", "desc").limit(50).get(),
    firestore.collection("rideSessions").where("participantUserIds", "array-contains", uid).limit(30).get(),
    firestore.collection("rideSessions").where("driverUserId", "==", uid).limit(30).get(),
    firestore.collection("ratings").where("authorUserId", "==", uid).limit(100).get(),
  ]);
  const rideDocs = [...new Map([...participantRides.docs, ...driverRides.docs].map((doc) => [doc.id, doc])).values()].map(toInboxDocument);
  const authoredRatingIds = new Set(ratings.docs.map((doc) => doc.id));
  return { inbox: {
    notifications: mapInboxNotifications(notifications.docs.map(toInboxDocument)),
    chats: buildInboxChats(messages.docs.map(toInboxDocument), uid),
    reviews: buildInboxReviewPrompts(rideDocs, authoredRatingIds, uid),
  } };
});

function toInboxDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): InboxDocument {
  return { id: doc.id, data: doc.data() };
}
