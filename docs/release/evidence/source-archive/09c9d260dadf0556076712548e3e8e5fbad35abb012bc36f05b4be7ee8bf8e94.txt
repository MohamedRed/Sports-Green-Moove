import {randomUUID} from "node:crypto";
import {Timestamp} from "firebase-admin/firestore";
import {teamAlertId} from "../domain/teamConversationAlerts.js";
import {teamPushAttemptLimit,teamPushDeliveryId,teamPushDeliverySchema,teamPushDispatchDecision,teamPushIsTerminal,teamPushLeaseMs,
  teamPushLifetimeMs,type TeamPushSender} from "../domain/teamPushDispatch.js";
import {teamPushRegistrationFingerprint,teamPushRegistrationRecordSchema,teamPushTokenId,
  teamPushTokenOwnerSchema} from "../domain/teamPushRegistration.js";
import {firestore} from "../lib/firestore.js";
import {currentDispatchEnvelope,dispatchAlertIsCurrent} from "./teamPushDispatchAuthority.js";

export class TeamPushRetryRequired extends Error {
  constructor(){super("Team push dispatch remains pending");}
}
export async function dispatchTeamPushDelivery(messageId:string,deliveryId:string,send:TeamPushSender,now=()=>Date.now()) {
  if(!/^[a-f0-9]{64}$/.test(deliveryId))throw new Error("Invalid team push delivery reference");
  const leaseId=randomUUID(),ref=firestore.collection("teamPushOutbox").doc(messageId).collection("deliveries").doc(deliveryId);
  const claim=await firestore.runTransaction(async transaction=>{
    const envelope=await currentDispatchEnvelope(transaction,messageId);if(!envelope)return null;
    const snapshot=await transaction.get(ref);if(!snapshot.exists)return null;
    const row=teamPushDeliverySchema.parse(snapshot.data());
    if(deliveryId!==teamPushDeliveryId(row.userId,row.installationId,row.revision))throw new Error("Team push delivery identity requires review");
    const decision=teamPushDispatchDecision(row,envelope.value.createdAt,now());
    if(decision==="done")return null;
    if(decision==="busy")throw new TeamPushRetryRequired();
    const at=Timestamp.fromMillis(now());
    if(decision==="expired" || decision==="exhausted") {
      transaction.update(ref,{status:decision==="expired"?"suppressed":"failed",updatedAt:at});return null;
    }
    const alertCurrent=await dispatchAlertIsCurrent(transaction,messageId,row.userId,envelope);
    const installation=await transaction.get(firestore.collection("teamPushInstallations").doc(row.installationId));
    const device=installation.exists?teamPushRegistrationRecordSchema.parse(installation.data()):null;
    if(device && device.fingerprint!==teamPushRegistrationFingerprint(device.userId,device))throw new Error("Team push device identity requires review");
    let current=alertCurrent && device?.active===true && device.token!==null && device.userId===row.userId &&
      device.revision===row.revision && device.fingerprint===row.fingerprint;
    if(current && device?.token) {
      const token=await transaction.get(firestore.collection("teamPushTokens").doc(teamPushTokenId(device.token)));
      const owner=teamPushTokenOwnerSchema.parse(token.data());
      if(owner.installationId!==row.installationId || owner.userId!==row.userId || owner.revision!==row.revision)
        throw new Error("Team push token identity requires review");
    } else current=false;
    if(!current || !device?.token){transaction.update(ref,{status:"suppressed",updatedAt:at});return null;}
    transaction.update(ref,{status:"sending",attempts:row.attempts+1,leaseId,
      leaseUntil:Timestamp.fromMillis(now()+teamPushLeaseMs),updatedAt:at});
    return {token:device.token,notificationId:teamAlertId(messageId,row.userId),
      ttlMs:Math.max(0,teamPushLifetimeMs-(now()-envelope.value.createdAt.toMillis()))};
  });
  if(!claim)return;
  // The provider is never called inside a retryable database transaction.
  let result;
  try {result=await send(claim.token,claim.notificationId,claim.ttlMs);}
  catch {result={status:"rejected" as const,reason:"unknown" as const};}
  const retry=await firestore.runTransaction(async transaction=>{
    const snapshot=await transaction.get(ref),row=teamPushDeliverySchema.parse(snapshot.data());
    if(row.status!=="sending" || row.leaseId!==leaseId)throw new TeamPushRetryRequired();
    const updatedAt=Timestamp.fromMillis(now());
    if(result.status==="accepted") {
      if(!result.providerId || result.providerId.length>512)throw new Error("Team push provider receipt requires review");
      transaction.update(ref,{status:"accepted",providerId:result.providerId,updatedAt});return false;
    }
    const terminal=result.reason==="invalid_token" || result.reason==="configuration" || row.attempts>=teamPushAttemptLimit;
    transaction.update(ref,{status:result.reason==="invalid_token"?"invalid_token":terminal?"failed":"queued",
      lastError:result.reason,updatedAt});return !terminal;
  });
  if(retry)throw new TeamPushRetryRequired();
}
export {teamPushIsTerminal};
