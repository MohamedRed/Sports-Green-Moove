import { randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { childAccountLinkSchema } from "../domain/childAccountLink.js";
import { childAccountCodeHash, childAccountCodeLifetimeMs, childAccountCodeCooldownMs,
  type ChildAccountApproval } from "../domain/childAccountApproval.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireRole } from "../lib/https.js";
import { requireEmergencyContactAuthority } from "./emergencyContactAuthority.js";

function childRoles(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const roles = value as Record<string, unknown>;
  return roles.child === true && ["parent", "driver", "clubManager", "admin"].every((role) => roles[role] !== true);
}
const denied = () => new HttpsError("permission-denied", "A current verified parent and child account are required.");

export async function createChildAccountApprovalCode(uid: string, token: unknown) {
  requireRole(token, "child");
  const code = randomBytes(16).toString("hex"), hash = childAccountCodeHash(code);
  return firestore.runTransaction(async (transaction) => {
    const ownerRef = firestore.collection("childAccountApprovalOwners").doc(uid);
    const [user, link, owner] = await transaction.getAll(firestore.collection("users").doc(uid),
      firestore.collection("childAccountLinks").doc(uid), ownerRef);
    if (!childRoles(user.get("roles"))) throw denied();
    if (link.exists) throw new HttpsError("failed-precondition", "This account already has a link requiring review.");
    const now = Timestamp.now(), previous = owner.get("createdAt"), previousHash: unknown = owner.get("codeHash");
    if (previous instanceof Timestamp && now.toMillis() - previous.toMillis() < childAccountCodeCooldownMs)
      throw new HttpsError("resource-exhausted", "Wait before creating another code.");
    if (owner.exists && (typeof previousHash !== "string" || !/^[a-f0-9]{64}$/.test(previousHash)))
      throw new HttpsError("failed-precondition", "The approval request requires review.");
    const expiresAt = Timestamp.fromMillis(now.toMillis() + childAccountCodeLifetimeMs);
    if (typeof previousHash === "string") transaction.delete(firestore.collection("childAccountApprovalRequests").doc(previousHash));
    transaction.set(ownerRef, { accountUserId: uid, codeHash: hash, createdAt: now });
    transaction.create(firestore.collection("childAccountApprovalRequests").doc(hash), {
      accountUserId: uid, createdAt: now, expiresAt, status: "pending",
    });
    return { accountUserId: uid, code, expiresAtMillis: expiresAt.toMillis() };
  });
}

export async function approveChildAccount(uid: string, token: unknown, input: ChildAccountApproval) {
  requireRole(token, "parent");
  if (hasRole(token, "child")) throw denied();
  const hash = childAccountCodeHash(input.code);
  return firestore.runTransaction(async (transaction) => {
    const identity = await requireEmergencyContactAuthority(transaction, uid, token,
      { kind: "child", childId: input.childId, clubId: input.clubId });
    if (identity.childInstanceId !== input.expectedChildInstanceId)
      throw new HttpsError("failed-precondition", "The child profile changed. Reload before approving.");
    const parent = await transaction.get(firestore.collection("users").doc(uid));
    const parentRoles: unknown = parent.get("roles");
    if (!parentRoles || typeof parentRoles !== "object" || !("parent" in parentRoles) || parentRoles.parent !== true ||
        "child" in parentRoles && parentRoles.child === true) throw denied();
    const requestRef = firestore.collection("childAccountApprovalRequests").doc(hash);
    const request = await transaction.get(requestRef), accountId: unknown = request.get("accountUserId");
    if (!request.exists || typeof accountId !== "string" || !accountId || accountId.includes("/") || accountId === uid)
      throw denied();
    const linkRef = firestore.collection("childAccountLinks").doc(accountId);
    const [childAccount, owner, link] = await transaction.getAll(firestore.collection("users").doc(accountId),
      firestore.collection("childAccountApprovalOwners").doc(accountId), linkRef);
    if (!childRoles(childAccount.get("roles")) || owner.get("codeHash") !== hash || owner.get("accountUserId") !== accountId)
      throw denied();
    if (request.get("status") === "approved") {
      const parsed = childAccountLinkSchema.safeParse(link.data());
      if (!parsed.success || parsed.data.status !== "verified" || parsed.data.accountUserId !== accountId ||
          parsed.data.childId !== input.childId || parsed.data.childInstanceId !== identity.childInstanceId ||
          parsed.data.verifiedByUserId !== uid || request.get("approvedByUserId") !== uid ||
          request.get("childId") !== input.childId || request.get("childInstanceId") !== identity.childInstanceId) throw denied();
      return { accountUserId: accountId, childId: input.childId, childInstanceId: identity.childInstanceId, replayed: true };
    }
    const now = Timestamp.now(), expiresAt: unknown = request.get("expiresAt");
    if (request.get("status") !== "pending" || !(expiresAt instanceof Timestamp) || expiresAt.toMillis() <= now.toMillis())
      throw new HttpsError("failed-precondition", "Create a new approval code.");
    if (link.exists) throw new HttpsError("already-exists", "The child account is already linked.");
    transaction.create(linkRef, { accountUserId: accountId, childId: input.childId, childInstanceId: identity.childInstanceId,
      status: "verified", verifiedAt: now, verifiedByUserId: uid });
    transaction.update(requestRef, { status: "approved", approvedByUserId: uid, childId: input.childId,
      childInstanceId: identity.childInstanceId, approvedAt: now });
    return { accountUserId: accountId, childId: input.childId, childInstanceId: identity.childInstanceId, replayed: false };
  });
}
