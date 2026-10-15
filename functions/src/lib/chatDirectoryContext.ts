import { HttpsError } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import type { ChatSource } from "../domain/chatInbox.js";
import { authorizedChatSource } from "./chatConversation.js";
import { firestore } from "./firebase.js";

export async function chatDirectoryContext(uid: string, source: ChatSource) {
  const { participantUserIds: participants, record: data } = await authorizedChatSource(uid, source);
  if (!data || typeof data.tripId !== "string" || !data.tripId || data.tripId.includes("/")) {
    throw new HttpsError("failed-precondition", "Conversation trip metadata requires repair.");
  }
  const trip = await firestore.collection("trips").doc(data.tripId).get();
  const title = trip.data()?.title;
  const departureAt = trip.data()?.departureAt;
  if (typeof title !== "string" || !title.trim()) throw new HttpsError("failed-precondition", "Conversation trip title is unavailable.");
  if (!(departureAt instanceof Timestamp)) throw new HttpsError("failed-precondition", "Conversation trip date is unavailable.");
  const otherIds = participants.filter((id) => id !== uid);
  const profiles = otherIds.length ? await firestore.getAll(...otherIds.map((id) => firestore.collection("users").doc(id))) : [];
  const names = profiles.flatMap((profile) => {
    const name = profile.data()?.displayName;
    return typeof name === "string" && name.trim() ? [name.trim()] : [];
  });
  return { title: title.trim(), departureLabel: new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" }).format(departureAt.toDate()),
    peerLabel: names.length ? names.join(" · ") : null,
    childLabel: typeof data.childLabel === "string" && data.childLabel.trim() ? data.childLabel.trim() : null,
    bookingStatus: source.sourceType === "booking" && typeof data.status === "string" ? data.status : null };
}
