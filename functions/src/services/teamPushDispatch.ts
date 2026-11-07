import {Timestamp} from "firebase-admin/firestore";
import {teamPushRecipientId,teamPushRecipientSchema,teamPushDeliverySchema,type TeamPushSender} from "../domain/teamPushDispatch.js";
import {firestore} from "../lib/firestore.js";
import {planTeamPushRecipient} from "./teamPushDispatchPlan.js";
import {dispatchTeamPushDelivery,teamPushIsTerminal} from "./teamPushDispatchDelivery.js";

export async function dispatchTeamPushRecipient(messageId:string,recipientId:string,send:TeamPushSender,now=()=>Date.now()) {
  const ids=await planTeamPushRecipient(messageId,recipientId,now);
  // Settle every owned attempt before surfacing retry; no detached provider requests.
  const attempts=await Promise.allSettled(ids.map(id=>dispatchTeamPushDelivery(messageId,id,send,now)));
  if(attempts.some(row=>row.status==="rejected"))throw new Error("Team push recipient dispatch remains pending");
  await firestore.runTransaction(async transaction=>{
    const root=firestore.collection("teamPushOutbox").doc(messageId),ref=root.collection("recipients").doc(recipientId);
    const snapshot=await transaction.get(ref);if(!snapshot.exists)return;
    const recipient=teamPushRecipientSchema.parse(snapshot.data());
    if(teamPushRecipientId(recipient.userId)!==recipientId)throw new Error("Team push recipient identity requires review");
    const deliveries=ids.length?await transaction.getAll(...ids.map(id=>root.collection("deliveries").doc(id))):[];
    if(deliveries.every(row=>teamPushIsTerminal(teamPushDeliverySchema.parse(row.data()).status)))
      transaction.update(ref,{status:"complete",completedAt:Timestamp.fromMillis(now())});
  });
}
