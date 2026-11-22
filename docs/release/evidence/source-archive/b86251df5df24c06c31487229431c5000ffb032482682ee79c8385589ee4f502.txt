import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { mapInboxNotifications } from "../domain/inbox.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { authorizedInboxNotifications } from "../services/teamNotificationAccess.js";

export const getNotificationInbox = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(z.object({}).strict(), request.data);
  return { userId: uid, notifications: mapInboxNotifications(await authorizedInboxNotifications(uid, request.auth?.token)) };
});
