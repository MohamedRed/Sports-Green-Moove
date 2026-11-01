import {Timestamp} from "firebase-admin/firestore";
import {z} from "zod";
import {chatDocumentIdSchema} from "./chatReference.js";
import {digest} from "./teamConversation.js";
import {teamAlertRecipientLimit} from "./teamConversationAlerts.js";

export const teamPushLifetimeMs = 60 * 60 * 1000;
export const teamPushLeaseMs = 10 * 60 * 1000;
export const teamPushAttemptLimit = 5;
const hash = z.string().length(64).regex(/^[a-f0-9]{64}$/);
export const teamPushOutboxSchema = z.object({
  schemaVersion:z.literal(1), status:z.enum(["pending","queued"]), messageId:hash,
  teamId:chatDocumentIdSchema, teamInstanceId:hash,
  recipientUserIds:z.array(chatDocumentIdSchema).min(1).max(teamAlertRecipientLimit)
    .refine(values=>new Set(values).size===values.length),
  createdAt:z.instanceof(Timestamp), queuedAt:z.instanceof(Timestamp).optional(),
}).strict();
export const teamPushRecipientSchema = z.object({
  userId:chatDocumentIdSchema, status:z.enum(["queued","planned","complete"]),
  deliveryIds:z.array(hash).max(20).optional(), createdAt:z.instanceof(Timestamp),
  completedAt:z.instanceof(Timestamp).optional(),
}).strict().refine(value=>value.status==="queued" ? value.deliveryIds===undefined : value.deliveryIds!==undefined);
export const teamPushDeliverySchema = z.object({
  userId:chatDocumentIdSchema, installationId:hash, revision:z.number().int().positive().max(Number.MAX_SAFE_INTEGER-1), fingerprint:hash,
  status:z.enum(["queued","sending","accepted","suppressed","invalid_token","failed"]),
  attempts:z.number().int().min(0).max(teamPushAttemptLimit), createdAt:z.instanceof(Timestamp),
  updatedAt:z.instanceof(Timestamp), leaseId:z.uuid().optional(), leaseUntil:z.instanceof(Timestamp).optional(),
  providerId:z.string().min(1).max(512).optional(),
  lastError:z.enum(["temporary","configuration","invalid_token","unknown"]).optional(),
}).strict().refine(value=>value.status!=="sending" || !!value.leaseId && !!value.leaseUntil && value.attempts>0)
  .refine(value=>value.status!=="accepted" || !!value.providerId);
export type TeamPushDelivery = z.infer<typeof teamPushDeliverySchema>;
export type TeamPushSendResult = {status:"accepted";providerId:string} |
  {status:"rejected";reason:"temporary"|"configuration"|"invalid_token"|"unknown"};
export type TeamPushSender = (token:string, notificationId:string, ttlMs:number)=>Promise<TeamPushSendResult>;
export const teamPushRecipientId=(uid:string)=>digest(["team-push-recipient",uid]);
export const teamPushDeliveryId=(uid:string,id:string,revision:number)=>digest(["team-push-delivery",uid,id,revision]);
export const teamPushIsTerminal=(status:TeamPushDelivery["status"])=>!["queued","sending"].includes(status);
export function teamPushDispatchDecision(row:TeamPushDelivery,createdAt:Timestamp,now:number) {
  if(teamPushIsTerminal(row.status))return "done";
  if(row.status==="sending" && row.leaseUntil && row.leaseUntil.toMillis()>now)return "busy";
  if(now-createdAt.toMillis()>=teamPushLifetimeMs)return "expired";
  if(row.attempts>=teamPushAttemptLimit)return "exhausted";
  return "send";
}
