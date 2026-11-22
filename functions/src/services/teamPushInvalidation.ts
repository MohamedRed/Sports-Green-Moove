import type {Transaction,Timestamp} from "firebase-admin/firestore";
import {teamPushRegistrationFingerprint,teamPushRegistrationRecordSchema,teamPushTokenId,
  teamPushTokenOwnerSchema} from "../domain/teamPushRegistration.js";
import {firestore} from "../lib/firestore.js";

type RejectedBinding={userId:string;installationId:string;revision:number;fingerprint:string};
export async function retireRejectedTeamPushBinding(transaction:Transaction,binding:RejectedBinding,token:string,at:Timestamp) {
  const ref=firestore.collection("teamPushInstallations").doc(binding.installationId);
  const tokenRef=firestore.collection("teamPushTokens").doc(teamPushTokenId(token));
  const [installation,owner]=await transaction.getAll(ref,tokenRef);
  const device=installation.exists?teamPushRegistrationRecordSchema.parse(installation.data()):null;
  if(!device || !device.active || device.userId!==binding.userId || device.revision!==binding.revision ||
    device.fingerprint!==binding.fingerprint || device.token!==token)return;
  if(device.fingerprint!==teamPushRegistrationFingerprint(device.userId,device))
    throw new Error("Rejected team push device identity requires review");
  const reverse=owner.exists?teamPushTokenOwnerSchema.parse(owner.data()):null;
  if(!reverse || reverse.installationId!==binding.installationId || reverse.userId!==binding.userId ||
    reverse.revision!==binding.revision)throw new Error("Rejected team push token identity requires review");
  // Retain the revision tombstone so an old registration cannot revive this binding.
  transaction.update(ref,{active:false,token:null,
    fingerprint:teamPushRegistrationFingerprint(device.userId,{...device,token:null}),updatedAt:at});
  transaction.delete(tokenRef);
}
