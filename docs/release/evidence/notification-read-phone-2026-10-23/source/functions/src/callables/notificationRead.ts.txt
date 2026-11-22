import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { firestore } from "../lib/firestore.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";

const schema = z.object({ userId: chatDocumentIdSchema, notificationId: chatDocumentIdSchema }).strict();

export const markNotificationRead = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const data = parseCallableData(schema, request.data);
  if (data.userId !== uid) throw new HttpsError("permission-denied", "The notification account changed.");
  const ref = firestore.collection("notifications").doc(data.notificationId);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    // Missing and foreign IDs have the same response; neither may be modified.
    if (!snapshot.exists || snapshot.get("userId") !== uid) {
      throw new HttpsError("not-found", "Notification not found.");
    }
    if (snapshot.get("read") !== true) {
      transaction.update(ref, { read: true, readAt: FieldValue.serverTimestamp() });
    }
  });
  // Reading an alert does not acknowledge a message, accept a booking or consent to a trip change.
  return { userId: uid, notificationId: ref.id, read: true };
});
