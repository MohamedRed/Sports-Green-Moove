import type {Transaction} from "firebase-admin/firestore";
import {HttpsError} from "firebase-functions/v2/https";
import {teamAlertId,teamAlertSchema} from "../domain/teamConversationAlerts.js";
import {teamPushOutboxSchema} from "../domain/teamPushDispatch.js";
import {firestore} from "../lib/firestore.js";
import {currentTeamConversationAccount,teamConversationAccounts} from "./teamConversationAccounts.js";
import {mayReadTeamNotification} from "./teamNotificationAccess.js";

export async function currentDispatchEnvelope(transaction:Transaction,messageId:string) {
  if(!/^[a-f0-9]{64}$/.test(messageId))throw new Error("Invalid team push envelope reference");
  const ref=firestore.collection("teamPushOutbox").doc(messageId),snapshot=await transaction.get(ref);
  if(!snapshot.exists)return null;
  const value=teamPushOutboxSchema.parse(snapshot.data());
  if(value.messageId!==messageId)throw new Error("Team push envelope identity requires review");
  return {ref,value};
}
export async function dispatchAlertIsCurrent(transaction:Transaction,messageId:string,uid:string,
  envelope:NonNullable<Awaited<ReturnType<typeof currentDispatchEnvelope>>>) {
  if(!envelope.value.recipientUserIds.includes(uid))throw new Error("Team push recipient identity requires review");
  const id=teamAlertId(messageId,uid),snapshot=await transaction.get(firestore.collection("teamChatNotifications").doc(id));
  if(!snapshot.exists)return false;
  const alert=teamAlertSchema.parse(snapshot.data());
  if(alert.messageId!==messageId || alert.userId!==uid || alert.teamId!==envelope.value.teamId ||
    alert.teamInstanceId!==envelope.value.teamInstanceId)throw new Error("Team push alert identity requires review");
  if(alert.read)return false;
  const accounts=teamConversationAccounts(transaction);
  try {
    const user=await currentTeamConversationAccount(transaction,uid,accounts);
    return await mayReadTeamNotification(transaction,uid,user.customClaims??{},id,snapshot.data()!,accounts);
  } catch(error) {
    if(error instanceof HttpsError && error.code==="permission-denied")return false;
    throw error;
  }
}
