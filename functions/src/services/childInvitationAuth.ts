import type { UserRecord } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";
import { auth } from "../lib/firebase.js";
import { invitationUnavailable } from "./childInvitationAuthority.js";

const code = (error: unknown) => (error as { code?: string } | null)?.code;
export function requireProvisionedChild(user: UserRecord, hash: string, email: string) {
  const claims = user.customClaims;
  if (user.email !== email || user.emailVerified || !claims || claims.childInvitationHash !== hash ||
      JSON.stringify(claims.roleKeys) !== JSON.stringify(["child"]) ||
      Object.keys(claims).some(key => !["roleKeys", "childInvitationHash"].includes(key))) throw invitationUnavailable();
}

export async function prepareInvitedChildAccount(uid: string, hash: string, email: string, password: string, displayName: string) {
  let user: UserRecord;
  try { user = await auth.getUser(uid); }
  catch (error) {
    if (code(error) !== "auth/user-not-found") throw new HttpsError("unavailable", "Account creation is temporarily unavailable.");
    try { user = await auth.createUser({ uid, email, password, displayName, disabled: true, emailVerified: false }); }
    catch (created) {
      if (["auth/invalid-password", "auth/invalid-email"].includes(code(created) ?? ""))
        throw new HttpsError("invalid-argument", "Check the email and password before retrying.");
      if (!["auth/uid-already-exists", "auth/email-already-exists"].includes(code(created) ?? ""))
        throw new HttpsError("unavailable", "Account creation is temporarily unavailable. Retry with the same details.");
      try { user = await auth.getUser(uid); }
      catch (lookup) {
        if (code(lookup) === "auth/user-not-found" && code(created) === "auth/email-already-exists")
          throw new HttpsError("already-exists", "An account already uses this email. No existing account was changed.");
        throw new HttpsError("unavailable", "Account creation is temporarily unavailable. Retry with the same details.");
      }
    }
  }
  if (!user.customClaims || Object.keys(user.customClaims).length === 0) {
    if (!user.disabled || user.email !== email || user.emailVerified) throw invitationUnavailable();
    await auth.setCustomUserClaims(uid, { roleKeys: ["child"], childInvitationHash: hash });
    user = await auth.getUser(uid);
  }
  requireProvisionedChild(user, hash, email);
  return user;
}

export async function enableInvitedChildAccount(uid: string, hash: string, email: string) {
  const user = await auth.getUser(uid); requireProvisionedChild(user, hash, email);
  if (user.disabled) await auth.updateUser(uid, { disabled: false });
}
