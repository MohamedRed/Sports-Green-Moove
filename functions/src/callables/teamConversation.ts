import { onCall } from "firebase-functions/v2/https";
import { sendTeamMessageSchema, teamConversationTargetSchema } from "../domain/teamConversation.js";
import { requireAuth } from "../lib/https.js";
import { membershipCursorSchema } from "../lib/membershipPageCursor.js";
import { parseCallableData } from "../lib/validation.js";
import { sendTeamConversationMessage, teamConversationPage } from "../services/teamConversation.js";
import { teamChatOptionsSchema, teamConversationOptions } from "../services/teamConversationOptions.js";
import { teamConversationReadSchema } from "../domain/teamConversationRead.js";
import { markTeamConversationMessagesRead } from "../services/teamConversationRead.js";

export const markTeamChatMessagesRead = onCall(async request => markTeamConversationMessagesRead(requireAuth(request.auth?.uid),
  request.auth?.token, parseCallableData(teamConversationReadSchema, request.data)));

export const listTeamChatOptions = onCall(async request => teamConversationOptions(requireAuth(request.auth?.uid),
  request.auth?.token, parseCallableData(teamChatOptionsSchema, request.data)));

export const sendTeamChatMessage = onCall(async request => {
  const uid = requireAuth(request.auth?.uid), input = parseCallableData(sendTeamMessageSchema, request.data);
  return sendTeamConversationMessage(uid, request.auth?.token, input);
});
export const getTeamChatMessages = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  const input = parseCallableData(teamConversationTargetSchema.extend({ cursor: membershipCursorSchema.optional() }), request.data);
  return teamConversationPage(uid, request.auth?.token, input, input.cursor);
});
