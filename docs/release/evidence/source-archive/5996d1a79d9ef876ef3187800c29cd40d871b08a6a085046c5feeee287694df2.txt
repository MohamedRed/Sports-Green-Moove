import type { QueryDocumentSnapshot, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { chatDocumentIdSchema } from "../domain/chatReference.js";
import { teamAlertRecipientLimit } from "../domain/teamConversationAlerts.js";
import type { TeamConversationTarget } from "../domain/teamConversation.js";
import { auth, firestore } from "../lib/firebase.js";
import { requireTeamConversationAccess, type TeamConversationAuthorityScope } from "./teamConversationAuthority.js";
import { readTeamEnrollment } from "./teamEnrollmentAuthority.js";

export async function teamConversationAlertAudience(transaction: Transaction, senderUid: string,
  target: TeamConversationTarget, scope: TeamConversationAuthorityScope): Promise<string[]> {
  const candidates = new Map<string, QueryDocumentSnapshot[]>();
  const add = (uid: string, entry: QueryDocumentSnapshot) => {
    if (uid === senderUid) return;
    candidates.set(uid, [...(candidates.get(uid) ?? []), entry]);
    if (candidates.size > teamAlertRecipientLimit)
      throw new HttpsError("resource-exhausted", "This team exceeds the supported notification audience limit.");
  };
  for (const snapshot of scope.approvals) {
    const entry = readTeamEnrollment(snapshot)!;
    if (entry.teamId !== target.teamId || entry.teamInstanceId !== target.expectedTeamInstanceId || entry.status !== "approved")
      throw new HttpsError("failed-precondition", "Team notification audience metadata requires review.");
    if (entry.subjectKind === "member") add(entry.subjectId, snapshot);
    else {
      const child = await transaction.get(firestore.collection("children").doc(entry.subjectId));
      if (!child.exists) continue;
      const guardians: unknown = child.get("guardianUserIds");
      if (guardians === undefined) continue;
      if (!Array.isArray(guardians) || guardians.some(uid => !chatDocumentIdSchema.safeParse(uid).success))
        throw new HttpsError("failed-precondition", "Team notification guardian identity requires review.");
      for (const uid of new Set(guardians as string[])) add(uid, snapshot);
    }
  }
  const users = new Map<string, { disabled: boolean; customClaims?: Record<string, unknown> }>();
  const ids = [...candidates.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const page = await auth.getUsers(ids.slice(offset, offset + 100).map(uid => ({ uid })));
    for (const user of page.users) users.set(user.uid, user);
  }
  const recipients: string[] = [];
  for (const [uid, approvals] of candidates) {
    const user = users.get(uid);
    if (!user || user.disabled) continue;
    try {
      await requireTeamConversationAccess(transaction, uid, user.customClaims ?? {}, target, { ...scope, approvals });
      recipients.push(uid);
    } catch (error) {
      if (!(error instanceof HttpsError) || error.code !== "permission-denied") throw error;
    }
  }
  return recipients.sort();
}
