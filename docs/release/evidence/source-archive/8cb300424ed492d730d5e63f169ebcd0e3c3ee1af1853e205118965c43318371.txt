import { getAuth, type UserRecord } from "firebase-admin/auth";
import type { Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

export type TeamConversationAccount = Pick<UserRecord, "uid" | "disabled" | "customClaims">;
export type TeamConversationAccounts = {
  transaction: Transaction;
  users: Map<string, Promise<TeamConversationAccount>>;
  load: (uid: string) => Promise<TeamConversationAccount>;
};
// One context per transaction attempt; never reuse authority across requests or retries.
export function teamConversationAccounts(transaction: Transaction,
  load: TeamConversationAccounts["load"] = uid => getAuth().getUser(uid)): TeamConversationAccounts {
  return { transaction, users: new Map(), load };
}
export async function currentTeamConversationAccount(transaction: Transaction, uid: string, accounts: TeamConversationAccounts) {
  if (accounts.transaction !== transaction) throw new HttpsError("failed-precondition", "Account authority must use the current transaction.");
  if (!accounts.users.has(uid)) accounts.users.set(uid, accounts.load(uid).catch(error => {
    if (error && typeof error === "object" && "code" in error && error.code === "auth/user-not-found")
      throw new HttpsError("permission-denied", "A current enabled account is required.");
    throw error;
  }));
  const account = await accounts.users.get(uid)!;
  if (account.uid !== uid) throw new HttpsError("failed-precondition", "Account authority identity requires review.");
  if (account.disabled) throw new HttpsError("permission-denied", "A current enabled account is required.");
  return account;
}
