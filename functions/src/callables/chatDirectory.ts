import { FieldPath, Filter, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { bookingParticipantUserIds } from "../domain/access.js";
import { chatInboxId } from "../domain/chatInbox.js";
import { chatReferenceSchema } from "../lib/chatConversation.js";
import { chatDirectoryContext } from "../lib/chatDirectoryContext.js";
import { directoryCursor, parseDirectoryCursor } from "../lib/chatDirectoryCursor.js";
import { checkedChatInbox } from "../lib/chatInboxIndex.js";
import { firestore } from "../lib/firebase.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

const pageInput = z.object({ cursor: z.string().min(1).max(2048).optional() });
const dateLabel = (at: Timestamp) => new Intl.DateTimeFormat("fr-BE", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Brussels",
}).format(at.toDate()).replaceAll("/", "-");

export const listChatConversations = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(pageInput, request.data);
  let query = firestore.collection("chatInboxes").where("userId", "==", uid)
    .orderBy("lastMessageAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (input.cursor) query = query.startAfter(...parseDirectoryCursor(input.cursor, "inbox", uid));
  const snapshot = await query.limit(21).get();
  const scanned = snapshot.docs.slice(0, 20);
  const items = [];
  const excludedIds: string[] = [];
  for (const doc of scanned) {
    const source = parseCallableData(chatReferenceSchema, doc.data());
    const entry = checkedChatInbox(doc.data(), uid, source);
    if (doc.id !== chatInboxId(uid, source)) throw new HttpsError("failed-precondition", "Conversation index identity requires repair.");
    let context;
    try { context = await chatDirectoryContext(uid, source); }
    catch (error) {
      if (error instanceof HttpsError && ["permission-denied", "not-found"].includes(error.code)) {
        excludedIds.push(doc.id);
        continue;
      }
      throw error;
    }
    items.push({ id: doc.id, ...source, ...context, preview: entry.lastMessageBody,
      dateLabel: dateLabel(entry.lastMessageAt), unreadCount: entry.unreadCount, initials: context.title.slice(0, 2).toUpperCase(),
      lastMessageSeconds: entry.lastMessageAt.seconds, lastMessageNanos: entry.lastMessageAt.nanoseconds, revision: entry.revision });
  }
  const last = scanned.at(-1);
  const position = (doc: typeof last) => doc ? {
    seconds: doc.get("lastMessageAt").seconds, nanos: doc.get("lastMessageAt").nanoseconds, id: doc.id,
  } : null;
  return { items, excludedIds, newest: position(scanned[0]), oldest: position(last), nextCursor: snapshot.size > 20 && last
    ? directoryCursor("inbox", uid, last.get("lastMessageAt"), last.id) : null };
});

export const listChatBookingOptions = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(pageInput, request.data);
  let query = firestore.collection("bookings").where(Filter.or(Filter.where("parentUserId", "==", uid),
    Filter.where("requesterUserId", "==", uid), Filter.where("driverUserId", "==", uid)))
    .orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (input.cursor) query = query.startAfter(...parseDirectoryCursor(input.cursor, "bookings", uid));
  const snapshot = await query.limit(21).get();
  const scanned = snapshot.docs.slice(0, 20);
  const items = [];
  for (const doc of scanned) {
    const createdAt = doc.get("createdAt");
    if (!(createdAt instanceof Timestamp)) throw new HttpsError("failed-precondition", "Booking timestamp requires repair.");
    if (!bookingParticipantUserIds(doc.data()).includes(uid)) continue;
    const source = { sourceType: "booking" as const, sourceId: doc.id };
    const context = await chatDirectoryContext(uid, source);
    items.push({ ...source, ...context, dateLabel: dateLabel(createdAt) });
  }
  const last = scanned.at(-1);
  return { items, nextCursor: snapshot.size > 20 && last
    ? directoryCursor("bookings", uid, last.get("createdAt"), last.id) : null };
});
