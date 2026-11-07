import { onCall } from "firebase-functions/v2/https";
import { ledgerSummaryRequest } from "../domain/ledgerSummaries.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { readImpactSummary, readRewardSummary } from "../services/ledgerSummaries.js";

export const getImpactSummary = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(ledgerSummaryRequest, request.data);
  return readImpactSummary(uid);
});
export const getRewardSummary = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  parseCallableData(ledgerSummaryRequest, request.data);
  return readRewardSummary(uid);
});
