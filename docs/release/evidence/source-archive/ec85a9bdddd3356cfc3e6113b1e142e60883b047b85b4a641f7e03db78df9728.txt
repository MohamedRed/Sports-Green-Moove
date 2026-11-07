import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { invitationRecordSchema } from "../domain/childInvitation.js";
import { firestore } from "../lib/firebase.js";

const denied = () => new HttpsError("permission-denied", "An intact invited-child account identity is required.");
export async function readChildInvitationBinding(transaction: Transaction, uid: string, profileHash: unknown, requiredHash?: unknown) {
  const origin = await transaction.get(firestore.collection("childAccountInvitationAccounts").doc(uid));
  // Accounts provisioned before invitation signup have no invitation marker. A partially missing invited identity is never that case.
  if (profileHash === undefined && requiredHash === undefined && !origin.exists) return null;
  if (typeof profileHash !== "string" || !/^[a-f0-9]{64}$/.test(profileHash) || !origin.exists ||
    requiredHash !== undefined && profileHash !== requiredHash || origin.get("invitationHash") !== profileHash) throw denied();
  const parsed = invitationRecordSchema.safeParse((await transaction.get(firestore.collection("childAccountInvitations").doc(profileHash))).data());
  if (!parsed.success || parsed.data.status !== "accepted" || parsed.data.accountUserId !== uid) throw denied();
  const invitation = parsed.data;
  for (const field of ["childId", "clubId", "childInstanceId", "parentUserId"] as const)
    if (origin.get(field) !== invitation[field]) throw denied();
  return { invitationHash: profileHash, childId: invitation.childId, clubId: invitation.clubId, childInstanceId: invitation.childInstanceId };
}
