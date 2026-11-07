import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { compareTimes } from "../domain/teamConversation.js";
import { compareInboxNotificationTimes } from "../domain/inbox.js";
import { teamAlertId, teamAlertSchema } from "../domain/teamConversationAlerts.js";
import { firestore } from "../lib/firestore.js";
import { requireTeamConversationAccess } from "./teamConversationAuthority.js";
import { teamContext } from "./teamEnrollmentAuthority.js";

export async function mayReadTeamNotification(transaction: Transaction, uid: string, token: unknown,
  notificationId: string, value: Record<string, unknown>): Promise<boolean> {
  const parsed = teamAlertSchema.safeParse(value);
  if (!parsed.success || notificationId !== teamAlertId(parsed.data.messageId, parsed.data.userId))
    throw new HttpsError("failed-precondition", "Team notification metadata requires review.");
  const data = parsed.data;
  if (data.userId !== uid) return false;
  const team = await transaction.get(firestore.collection("teams").doc(data.teamId));
  if (!team.exists || teamContext(team).teamInstanceId !== data.teamInstanceId) return false;
  const message = await transaction.get(firestore.collection("teamConversations").doc(data.teamInstanceId)
    .collection("entries").doc(data.messageId));
  if (!message.exists) return false;
  const at = message.get("createdAt");
  if (!(at instanceof Timestamp) || !at.isEqual(data.messageCreatedAt) || message.get("senderUserId") === uid)
    throw new HttpsError("failed-precondition", "Team notification message identity requires review.");
  try {
    const access = await requireTeamConversationAccess(transaction, uid, token,
      { teamId: data.teamId, expectedTeamInstanceId: data.teamInstanceId });
    return compareTimes(at, access.availableAfter) > 0;
  } catch (error) {
    if (!(error instanceof HttpsError) || error.code !== "permission-denied") throw error;
    return false;
  }
}

export async function authorizedInboxNotifications(uid: string, token: unknown) {
  return firestore.runTransaction(async transaction => {
    const [ordinary, teams] = await Promise.all(["notifications", "teamChatNotifications"].map(collection =>
      transaction.get(firestore.collection(collection).where("userId", "==", uid)
        .orderBy("createdAt", "desc").limit(20))));
    const visible = ordinary.docs.map(row => ({ id: row.id, data: row.data() }));
    for (const row of teams.docs) {
      if (await mayReadTeamNotification(transaction, uid, token, row.id, row.data()))
        visible.push({ id: row.id, data: row.data() });
    }
    return visible.sort(compareInboxNotificationTimes).slice(0, 20);
  });
}
