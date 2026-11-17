import { type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { teamAlertBody, teamAlertSchema, teamAlertTitle } from "../domain/teamConversationAlerts.js";
import { type TeamPushAlertRequest } from "../domain/teamPushAlert.js";
import { teamPushInstallationId, teamPushRegistrationFingerprint, teamPushRegistrationRecordSchema,
  teamPushSecretHash, teamPushTokenId, teamPushTokenOwnerSchema } from "../domain/teamPushRegistration.js";
import { firestore } from "../lib/firestore.js";
import { teamConversationAccounts } from "./teamConversationAccounts.js";
import { requireTeamConversationAdult } from "./teamConversationAuthority.js";
import { mayReadTeamNotification } from "./teamNotificationAccess.js";

async function requireCurrentInstallation(transaction: Transaction, uid: string, input: TeamPushAlertRequest) {
  const installationId = teamPushInstallationId(input.installationId);
  const snapshot = await transaction.get(firestore.collection("teamPushInstallations").doc(installationId));
  if (!snapshot.exists) throw new HttpsError("permission-denied", "A current device registration is required.");
  const parsed = teamPushRegistrationRecordSchema.safeParse(snapshot.data());
  if (!parsed.success || parsed.data.fingerprint !== teamPushRegistrationFingerprint(parsed.data.userId, parsed.data))
    throw new HttpsError("failed-precondition", "Device registration identity requires review.");
  const device = parsed.data;
  if (!device.active || device.token === null || device.userId !== uid || device.revision !== input.revision ||
      device.secretHash !== teamPushSecretHash(input.installationSecret))
    throw new HttpsError("permission-denied", "A current device registration is required.");
  const token = await transaction.get(firestore.collection("teamPushTokens").doc(teamPushTokenId(device.token)));
  const owner = teamPushTokenOwnerSchema.safeParse(token.data());
  if (!owner.success || owner.data.installationId !== installationId || owner.data.userId !== uid ||
      owner.data.revision !== device.revision)
    throw new HttpsError("failed-precondition", "Device token identity requires review.");
}

export async function resolveCurrentTeamPushAlert(uid: string, claims: unknown, input: TeamPushAlertRequest) {
  return firestore.runTransaction(async transaction => {
    const accounts = teamConversationAccounts(transaction);
    await requireTeamConversationAdult(transaction, uid, claims, accounts);
    await requireCurrentInstallation(transaction, uid, input);
    const snapshot = await transaction.get(firestore.collection("teamChatNotifications").doc(input.notificationId));
    const suppressed = { status: "suppressed" as const };
    // Foreign, missing and no-longer-authorised alerts expose the same empty result.
    if (!snapshot.exists || snapshot.get("userId") !== uid) return suppressed;
    if (!await mayReadTeamNotification(transaction, uid, claims, snapshot.id, snapshot.data()!, accounts)) return suppressed;
    const alert = teamAlertSchema.parse(snapshot.data());
    if (input.purpose === "display" && alert.read) return suppressed;
    // An alert never contains message text, an author name, a child identity or a client-provided URL.
    return { status: "available" as const, notificationId: snapshot.id, title: teamAlertTitle, body: teamAlertBody,
      target: { teamId: alert.teamId, expectedTeamInstanceId: alert.teamInstanceId } };
  });
}
