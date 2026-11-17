import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {queueTeamPushRecipients} from "./services/teamPushDispatchPlan.js";
import {dispatchTeamPushRecipient} from "./services/teamPushDispatch.js";
import {sendTeamPush,teamPushProviderEnabled} from "./services/teamPushProvider.js";

export const queueTeamMessagePush=onDocumentCreated({document:"teamPushOutbox/{messageId}",retry:true},async event=>{
  if(!teamPushProviderEnabled())return;
  try {await queueTeamPushRecipients(event.params.messageId);}
  catch {throw new Error("Team push queue requires review or retry");}
});
export const sendTeamMessagePush=onDocumentCreated({document:"teamPushOutbox/{messageId}/recipients/{recipientId}",
  retry:true,timeoutSeconds:540},async event=>{
  if(!teamPushProviderEnabled())return;
  try {await dispatchTeamPushRecipient(event.params.messageId,event.params.recipientId,sendTeamPush);}
  catch {throw new Error("Team push dispatch requires review or retry");}
});
