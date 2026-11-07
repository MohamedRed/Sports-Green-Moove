import {getApp} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";
import type {TeamPushSender,TeamPushSendResult} from "../domain/teamPushDispatch.js";

export function teamPushProviderEnabled() {
  const projectId=getApp().options.projectId ?? process.env.GCLOUD_PROJECT;
  return process.env.FUNCTIONS_EMULATOR!=="true" && !!projectId && !projectId.startsWith("demo-") &&
    !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST;
}
export function teamPushProviderFailure(code:unknown):TeamPushSendResult {
  if(code==="messaging/registration-token-not-registered" || code==="messaging/invalid-registration-token")
    return {status:"rejected",reason:"invalid_token"};
  if(["messaging/mismatched-credential","messaging/authentication-error","messaging/invalid-argument"].includes(String(code)))
    return {status:"rejected",reason:"configuration"};
  if(["messaging/server-unavailable","messaging/internal-error","messaging/message-rate-exceeded",
    "messaging/device-message-rate-exceeded","messaging/quota-exceeded"].includes(String(code)))
    return {status:"rejected",reason:"temporary"};
  return {status:"rejected",reason:"unknown"};
}
export const sendTeamPush:TeamPushSender=async(token,notificationId,ttlMs)=>{
  if(!teamPushProviderEnabled())throw new Error("Real messaging is disabled in isolated environments");
  try {
    const providerId=await getMessaging().send({token,data:{type:"teamMessage",notificationId},
      android:{priority:"high",ttl:ttlMs}});
    return {status:"accepted",providerId};
  } catch(error) {
    return teamPushProviderFailure(error && typeof error==="object" && "code" in error ? error.code : undefined);
  }
};
