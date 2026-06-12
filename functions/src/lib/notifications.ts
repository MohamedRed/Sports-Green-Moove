import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebase.js";

type NotificationInput = {
  type: string;
  title: string;
  body: string;
  sourceId?: string;
};

export async function notifyUsers(userIds: readonly string[], notification: NotificationInput): Promise<void> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return;

  const batch = firestore.batch();
  for (const userId of uniqueUserIds) {
    const ref = firestore.collection("notifications").doc();
    batch.set(ref, {
      ...notification,
      userId,
      read: false,
      createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
}
