import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { bookingNotificationId, type BookingNoticeType } from "../domain/bookingNotifications.js";
import { firestore } from "./firebase.js";

type BookingNotice = { type: BookingNoticeType; sourceId: string; title: string; body: string };

export function createBookingNotifications(transaction: Transaction, userIds: readonly string[], notice: BookingNotice): void {
  const createdAt = Timestamp.now();
  for (const userId of new Set(userIds.filter(Boolean))) {
    const ref = firestore.collection("notifications").doc(bookingNotificationId(notice.type, notice.sourceId, userId));
    transaction.create(ref, { ...notice, userId, read: false, createdAt });
  }
}
