import { onCall } from "firebase-functions/v2/https";
import { childAccountApprovalSchema, childAccountRequestSchema } from "../domain/childAccountApproval.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { approveChildAccount, createChildAccountApprovalCode } from "../services/childAccountApproval.js";

export const createChildAccountLinkCode = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(childAccountRequestSchema, request.data);
  return createChildAccountApprovalCode(uid, request.auth?.token);
});
export const approveChildAccountLink = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  return approveChildAccount(uid, request.auth?.token, parseCallableData(childAccountApprovalSchema, request.data));
});
