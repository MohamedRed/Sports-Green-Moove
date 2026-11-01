import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { chatDocumentIdSchema } from "./chatReference.js";
import { digest } from "./teamConversation.js";

export const teamAlertTitle = "Nouveau message d’équipe";
export const teamAlertBody = "Un nouveau message est disponible dans votre équipe.";
export const teamAlertRecipientLimit = 496;
export const teamAlertId = (messageId: string, uid: string) => "teamChat_" + digest([messageId, uid]);
export const teamAlertSchema = z.object({
  type: z.literal("teamMessage"), userId: chatDocumentIdSchema, teamId: chatDocumentIdSchema,
  teamInstanceId: z.string().regex(/^[a-f0-9]{64}$/), messageId: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.literal(teamAlertTitle), body: z.literal(teamAlertBody),
  createdAt: z.instanceof(Timestamp), messageCreatedAt: z.instanceof(Timestamp), read: z.boolean(),
});
