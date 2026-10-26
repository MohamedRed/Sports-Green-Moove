import { HttpsError, onCall } from "firebase-functions/v2/https";
import { childInvitationTargetSchema, redeemChildInvitationSchema, revokeChildInvitationSchema } from "../domain/childInvitation.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { createChildInvitation as create, revokeChildInvitation as revoke, getChildInvitation as get } from "../services/childInvitations.js";
import { redeemChildInvitation as redeem } from "../services/childInvitationRedemption.js";

export const createChildInvitation = onCall(request => create(requireAuth(request.auth?.uid), request.auth?.token,
  parseCallableData(childInvitationTargetSchema, request.data)));
export const revokeChildInvitation = onCall(request => revoke(requireAuth(request.auth?.uid), request.auth?.token,
  parseCallableData(revokeChildInvitationSchema, request.data)));
export const getChildInvitation = onCall(request => get(requireAuth(request.auth?.uid), request.auth?.token,
  parseCallableData(childInvitationTargetSchema, request.data)));
export const redeemChildInvitation = onCall(async request => {
  if (request.auth) throw new HttpsError("failed-precondition", "Use the separate invitation signup page.");
  const input = parseCallableData(redeemChildInvitationSchema, request.data);
  try { return await redeem(input); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unavailable", "Account creation is temporarily unavailable. Retry with the same details.");
  }
});
