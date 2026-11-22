import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { teamPushDeviceLimit, teamPushInstallationId, teamPushRegistrationFingerprint,
  teamPushRegistrationRecordSchema, teamPushSecretHash, teamPushTokenId, teamPushTokenOwnerSchema,
  type TeamPushRegistration } from "../domain/teamPushRegistration.js";
import { auth, firestore } from "../lib/firebase.js";
import { requireTeamConversationAdult } from "./teamConversationAuthority.js";

export async function registerTeamPushInstallation(uid: string, claims: unknown, input: TeamPushRegistration) {
  const account = await auth.getUser(uid);
  if (account.disabled) throw new HttpsError("permission-denied", "An enabled account is required.");
  const installationId = teamPushInstallationId(input.installationId), secretHash = teamPushSecretHash(input.installationSecret);
  const fingerprint = teamPushRegistrationFingerprint(uid, input);
  const ref = firestore.collection("teamPushInstallations").doc(installationId);
  return firestore.runTransaction(async transaction => {
    if (input.token !== null) await requireTeamConversationAdult(transaction, uid, claims);
    const snapshot = await transaction.get(ref);
    const parsed = snapshot.exists ? teamPushRegistrationRecordSchema.safeParse(snapshot.data()) : null;
    if (parsed && !parsed.success) throw new HttpsError("failed-precondition", "Device registration requires review.");
    const previous = parsed?.data;
    if (previous && previous.fingerprint !== teamPushRegistrationFingerprint(previous.userId, previous))
      throw new HttpsError("failed-precondition", "Device registration identity requires review.");
    if (previous && previous.secretHash !== secretHash)
      throw new HttpsError("permission-denied", "Device registration proof is required.");
    if (previous && input.token === null && previous.userId !== uid)
      throw new HttpsError("permission-denied", "Only the current device account can remove its registration.");
    const reused = previous && input.revision === previous.revision && fingerprint === previous.fingerprint;
    if (previous && input.revision <= previous.revision && !reused) {
      throw new HttpsError("aborted", "The device registration has changed. Use the latest local revision.");
    }
    const oldTokenId = previous?.token ? teamPushTokenId(previous.token) : null;
    const newTokenId = input.token ? teamPushTokenId(input.token) : null;
    const tokenIds = [...new Set([oldTokenId, newTokenId].filter((id): id is string => id !== null))];
    const tokens = tokenIds.length ? await transaction.getAll(...tokenIds.map(id => firestore.collection("teamPushTokens").doc(id))) : [];
    const owners = new Map(tokens.map(row => {
      const parsed = row.exists ? teamPushTokenOwnerSchema.safeParse(row.data()) : null;
      if (parsed && !parsed.success) throw new HttpsError("failed-precondition", "Device token identity requires review.");
      return [row.id, parsed?.data];
    }));
    if (oldTokenId) {
      const old = owners.get(oldTokenId);
      if (!old || old.installationId !== installationId || old.userId !== previous!.userId || old.revision !== previous!.revision)
        throw new HttpsError("failed-precondition", "The prior device token identity requires review.");
    }
    const incoming = newTokenId ? owners.get(newTokenId) : undefined;
    if (incoming && incoming.installationId !== installationId)
      throw new HttpsError("already-exists", "This device token is already registered to another installation.");
    if (incoming && (!previous || newTokenId !== oldTokenId))
      throw new HttpsError("failed-precondition", "The device token binding requires review.");
    if (reused) return { currentUserId: uid, revision: previous.revision, active: previous.active, reused: true };
    if (input.token !== null && (!previous?.active || previous.userId !== uid)) {
      const active = await transaction.get(firestore.collection("teamPushInstallations")
        .where("userId", "==", uid).where("active", "==", true).limit(teamPushDeviceLimit));
      if (active.size >= teamPushDeviceLimit)
        throw new HttpsError("resource-exhausted", "This account has reached its active device limit.");
    }
    const now = Timestamp.now(), active = input.token !== null;
    if (oldTokenId && oldTokenId !== newTokenId) transaction.delete(firestore.collection("teamPushTokens").doc(oldTokenId));
    if (newTokenId) transaction.set(firestore.collection("teamPushTokens").doc(newTokenId), { installationId, userId: uid, revision: input.revision });
    transaction.set(ref, { schemaVersion: 1, userId: uid, platform: input.platform, secretHash, revision: input.revision,
      fingerprint, active, token: input.token, createdAt: previous?.createdAt ?? now, updatedAt: now });
    return { currentUserId: uid, revision: input.revision, active, reused: false };
  });
}
