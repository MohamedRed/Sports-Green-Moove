import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { InvitationTarget, InvitationRecord } from "../domain/childInvitation.js";
import { firestore } from "../lib/firebase.js";
import { hasRole, requireRole } from "../lib/https.js";
import { requireEmergencyContactAuthority } from "./emergencyContactAuthority.js";

export const invitationUnavailable = () => new HttpsError("failed-precondition", "This invitation is unavailable. Ask the parent for a new link.");
export async function requireInvitationParent(transaction: Transaction, uid: string, token: unknown, input: InvitationTarget) {
  requireRole(token, "parent");
  if (hasRole(token, "child")) throw new HttpsError("permission-denied", "A verified parent is required.");
  const identity = await requireEmergencyContactAuthority(transaction, uid, token,
    { kind: "child", childId: input.childId, clubId: input.clubId });
  const parent = await transaction.get(firestore.collection("users").doc(uid));
  const roles = parent.get("roles");
  if (roles?.parent !== true || roles?.child === true) throw new HttpsError("permission-denied", "A current parent role is required.");
  if (identity.childInstanceId !== input.expectedChildInstanceId) throw invitationUnavailable();
  return identity;
}
export async function requireInvitationCurrentAuthority(transaction: Transaction, invitation: InvitationRecord, hash: string) {
  const identity = await requireInvitationParent(transaction, invitation.parentUserId, { roleKeys: ["parent"] }, {
    childId: invitation.childId, clubId: invitation.clubId, expectedChildInstanceId: invitation.childInstanceId,
  });
  const owner = await transaction.get(firestore.collection("childAccountInvitationOwners").doc(invitation.ownerId));
  if (owner.get("invitationHash") !== hash) throw invitationUnavailable();
  return identity;
}
