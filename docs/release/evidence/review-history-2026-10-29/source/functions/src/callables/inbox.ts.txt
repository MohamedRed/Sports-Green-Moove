import { onCall } from "firebase-functions/v2/https";
import { buildInboxChats, buildInboxReviewPrompts, mapInboxNotifications, type InboxDocument } from "../domain/inbox.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";

export const getInbox = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const [notifications, messages, participantRides, driverRides] = await Promise.all([
    firestore.collection("notifications").where("userId", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
    firestore.collection("messages").where("participantUserIds", "array-contains", uid).orderBy("createdAt", "desc").limit(50).get(),
    firestore.collection("rideSessions").where("participantUserIds", "array-contains", uid).limit(30).get(),
    firestore.collection("rideSessions").where("driverUserId", "==", uid).limit(30).get(),
  ]);
  const rideDocs = [...new Map([...participantRides.docs, ...driverRides.docs].map((doc) => [doc.id, doc])).values()].map(toInboxDocument);
  const reviewCandidates = buildInboxReviewPrompts(rideDocs, new Set(), uid);
  const ratings = reviewCandidates.length
    ? await firestore.getAll(...reviewCandidates.map((review) => firestore.collection("ratings").doc(review.id)))
    : [];
  const authoredRatingIds = new Set(ratings.filter((doc) => doc.exists).map((doc) => doc.id));
  return { inbox: {
    notifications: mapInboxNotifications(notifications.docs.map(toInboxDocument)),
    chats: buildInboxChats(messages.docs.map(toInboxDocument), uid),
    reviews: reviewCandidates.filter((review) => !authoredRatingIds.has(review.id)),
  } };
});

function toInboxDocument(doc: FirebaseFirestore.QueryDocumentSnapshot): InboxDocument {
  return { id: doc.id, data: doc.data() };
}
