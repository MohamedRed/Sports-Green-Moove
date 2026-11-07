import { randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { invitationCooldownMs, invitationHash, invitationLifetimeMs, invitationOwnerId, invitationRecordSchema,
  invitationUrl, type InvitationTarget } from "../domain/childInvitation.js";
import { firestore } from "../lib/firebase.js";
import { invitationUnavailable, requireInvitationParent } from "./childInvitationAuthority.js";

export async function createChildInvitation(uid: string, token: unknown, input: InvitationTarget) {
  const secret = randomBytes(32).toString("hex"), hash = invitationHash(secret);
  return firestore.runTransaction(async transaction => {
    const identity = await requireInvitationParent(transaction, uid, token, input);
    const ownerId = invitationOwnerId(input.childId, input.expectedChildInstanceId);
    const ownerRef = firestore.collection("childAccountInvitationOwners").doc(ownerId);
    const owner = await transaction.get(ownerRef);
    const links = await transaction.get(firestore.collection("childAccountLinks").where("childInstanceId", "==", input.expectedChildInstanceId).limit(1));
    if (!links.empty) throw new HttpsError("already-exists", "This child already has an account link requiring review.");
    const now = Timestamp.now(), createdAt: unknown = owner.get("createdAt"), previousHash: unknown = owner.get("invitationHash");
    let previousRef;
    if (owner.exists) {
      if (typeof previousHash !== "string" || !/^[a-f0-9]{64}$/.test(previousHash)) throw invitationUnavailable();
      previousRef = firestore.collection("childAccountInvitations").doc(previousHash);
      const previous = invitationRecordSchema.safeParse((await transaction.get(previousRef)).data());
      if (!previous.success || ["provisioning", "accepted"].includes(previous.data.status)) throw invitationUnavailable();
      if (!(createdAt instanceof Timestamp) || now.toMillis() - createdAt.toMillis() < invitationCooldownMs)
        throw new HttpsError("resource-exhausted", "Wait before creating another invitation.");
    }
    const expiresAt = Timestamp.fromMillis(now.toMillis() + invitationLifetimeMs);
    if (previousRef) transaction.update(previousRef, { status: "revoked", revokedAt: now });
    transaction.create(firestore.collection("childAccountInvitations").doc(hash), {
      parentUserId: uid, childId: input.childId, clubId: input.clubId, childInstanceId: input.expectedChildInstanceId,
      ownerId, status: "pending", createdAt: now, expiresAt,
    });
    transaction.set(ownerRef, { invitationHash: hash, createdAt: now });
    return { childId: input.childId, childInstanceId: identity.childInstanceId, invitationHash: hash,
      url: invitationUrl(secret), expiresAtMillis: expiresAt.toMillis() };
  });
}

export async function revokeChildInvitation(uid: string, token: unknown, input: InvitationTarget & { invitationHash: string }) {
  return firestore.runTransaction(async transaction => {
    await requireInvitationParent(transaction, uid, token, input);
    const owner = await transaction.get(firestore.collection("childAccountInvitationOwners")
      .doc(invitationOwnerId(input.childId, input.expectedChildInstanceId)));
    const ref = firestore.collection("childAccountInvitations").doc(input.invitationHash);
    const parsed = invitationRecordSchema.safeParse((await transaction.get(ref)).data());
    if (!parsed.success || owner.get("invitationHash") !== input.invitationHash || parsed.data.childId !== input.childId ||
      parsed.data.childInstanceId !== input.expectedChildInstanceId || parsed.data.clubId !== input.clubId) throw invitationUnavailable();
    if (["accepted", "provisioning"].includes(parsed.data.status))
      throw new HttpsError("failed-precondition", "This invitation has been claimed. Finish signup with the original link and details; account linking remains separate.");
    if (parsed.data.status !== "revoked") transaction.update(ref, { status: "revoked", revokedAt: Timestamp.now() });
    return { revoked: true, invitationHash: input.invitationHash };
  });
}

export async function getChildInvitation(uid: string, token: unknown, input: InvitationTarget) {
  return firestore.runTransaction(async transaction => {
    await requireInvitationParent(transaction, uid, token, input);
    const owner = await transaction.get(firestore.collection("childAccountInvitationOwners")
      .doc(invitationOwnerId(input.childId, input.expectedChildInstanceId)));
    if (!owner.exists) return { current: null };
    const hash: unknown = owner.get("invitationHash");
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) throw invitationUnavailable();
    const parsed = invitationRecordSchema.safeParse((await transaction.get(firestore.collection("childAccountInvitations").doc(hash))).data());
    if (!parsed.success || parsed.data.childId !== input.childId || parsed.data.childInstanceId !== input.expectedChildInstanceId ||
      parsed.data.clubId !== input.clubId) throw invitationUnavailable();
    return { current: { invitationHash: hash, status: parsed.data.status, expiresAtMillis: parsed.data.expiresAt.toMillis() } };
  });
}
