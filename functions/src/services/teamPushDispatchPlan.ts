import {Timestamp} from "firebase-admin/firestore";
import {teamPushDeliveryId,teamPushLifetimeMs,teamPushRecipientId,teamPushRecipientSchema} from "../domain/teamPushDispatch.js";
import {teamPushDeviceLimit,teamPushRegistrationFingerprint,teamPushRegistrationRecordSchema,
  teamPushTokenId,teamPushTokenOwnerSchema} from "../domain/teamPushRegistration.js";
import {firestore} from "../lib/firestore.js";
import {currentDispatchEnvelope,dispatchAlertIsCurrent} from "./teamPushDispatchAuthority.js";

export async function queueTeamPushRecipients(messageId:string) {
  return firestore.runTransaction(async transaction=>{
    const envelope=await currentDispatchEnvelope(transaction,messageId);
    if(!envelope || envelope.value.status==="queued")return;
    const now=Timestamp.now();
    for(const userId of envelope.value.recipientUserIds)transaction.create(envelope.ref.collection("recipients")
      .doc(teamPushRecipientId(userId)),{userId,status:"queued",createdAt:now});
    transaction.update(envelope.ref,{status:"queued",queuedAt:now});
  });
}

export async function planTeamPushRecipient(messageId:string,recipientId:string,now=()=>Date.now()) {
  if(!/^[a-f0-9]{64}$/.test(recipientId))throw new Error("Invalid team push recipient reference");
  return firestore.runTransaction(async transaction=>{
    const envelope=await currentDispatchEnvelope(transaction,messageId);if(!envelope)return [];
    const ref=envelope.ref.collection("recipients").doc(recipientId),snapshot=await transaction.get(ref);
    if(!snapshot.exists)return [];
    const recipient=teamPushRecipientSchema.parse(snapshot.data());
    if(recipientId!==teamPushRecipientId(recipient.userId))throw new Error("Team push recipient identity requires review");
    if(recipient.status!=="queued")return recipient.deliveryIds??[];
    const expired=now()-envelope.value.createdAt.toMillis()>=teamPushLifetimeMs;
    const eligible=!expired && await dispatchAlertIsCurrent(transaction,messageId,recipient.userId,envelope);
    const devices=eligible ? (await transaction.get(firestore.collection("teamPushInstallations")
      .where("userId","==",recipient.userId).where("active","==",true).limit(teamPushDeviceLimit+1))).docs:[];
    if(devices.length>teamPushDeviceLimit)throw new Error("Team push device limit requires review");
    const records=devices.map(snapshot=>{
      const device=teamPushRegistrationRecordSchema.parse(snapshot.data());
      if(device.userId!==recipient.userId || !device.active || device.token===null ||
        device.fingerprint!==teamPushRegistrationFingerprint(device.userId,device))throw new Error("Team push device identity requires review");
      return {id:snapshot.id,device};
    });
    const owners=records.length ? await transaction.getAll(...records.map(row=>firestore.collection("teamPushTokens")
      .doc(teamPushTokenId(row.device.token!)))):[];
    records.forEach((row,index)=>{
      const owner=teamPushTokenOwnerSchema.parse(owners[index].data());
      if(owner.installationId!==row.id || owner.userId!==row.device.userId || owner.revision!==row.device.revision)
        throw new Error("Team push token identity requires review");
    });
    const at=Timestamp.fromMillis(now()),ids=records.map(row=>teamPushDeliveryId(recipient.userId,row.id,row.device.revision));
    records.forEach((row,index)=>transaction.create(envelope.ref.collection("deliveries").doc(ids[index]),{
      userId:recipient.userId,installationId:row.id,revision:row.device.revision,fingerprint:row.device.fingerprint,
      status:"queued",attempts:0,createdAt:at,updatedAt:at,
    }));
    transaction.update(ref,{status:ids.length?"planned":"complete",deliveryIds:ids,...(!ids.length?{completedAt:at}:{})});
    return ids;
  });
}
