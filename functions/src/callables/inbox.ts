import { onCall } from "firebase-functions/v2/https";
import { buildInboxChats, mapInboxNotifications, type InboxDocument } from "../domain/inbox.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { pendingReviewPage } from "../services/pendingReviews.js";
import { authorizedInboxNotifications } from "../services/teamNotificationAccess.js";

export const getInbox = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const [notifications, messages, reviews] = await Promise.all([
    authorizedInboxNotifications(uid, request.auth?.token),
    firestore.collection("messages").where("participantUserIds", "array-contains", uid).orderBy("createdAt", "desc").limit(50).get(),
    pendingReviewPage(uid),
  ]);
  return { inbox: {
    notifications: mapInboxNotifications(notifications),
    chats: buildInboxChats(messages.docs.map(toInboxDocument), uid),
    reviews: reviews.items,
    reviewsNextCursor: reviews.nextCursor,
    reviewsUserId: reviews.userId,
  } };
});

function toInboxDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): InboxDocument {
  return { id: doc.id, data: doc.data() };
}
