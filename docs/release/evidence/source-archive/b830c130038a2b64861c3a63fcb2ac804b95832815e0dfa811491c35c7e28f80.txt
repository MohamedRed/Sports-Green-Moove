import { onCall } from "firebase-functions/v2/https";
import { buildInboxChats, mapInboxNotifications, type InboxDocument } from "../domain/inbox.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { pendingReviewPage } from "../services/pendingReviews.js";

export const getInbox = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const [notifications, messages, reviews] = await Promise.all([
    firestore.collection("notifications").where("userId", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
    firestore.collection("messages").where("participantUserIds", "array-contains", uid).orderBy("createdAt", "desc").limit(50).get(),
    pendingReviewPage(uid),
  ]);
  return { inbox: {
    notifications: mapInboxNotifications(notifications.docs.map(toInboxDocument)),
    chats: buildInboxChats(messages.docs.map(toInboxDocument), uid),
    reviews: reviews.items,
    reviewsNextCursor: reviews.nextCursor,
    reviewsUserId: reviews.userId,
  } };
});

function toInboxDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): InboxDocument {
  return { id: doc.id, data: doc.data() };
}
