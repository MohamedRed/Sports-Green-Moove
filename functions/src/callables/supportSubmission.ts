import { onCall } from "firebase-functions/v2/https";
import { supportSubmissionSchema } from "../domain/supportSubmission.js";
import { requireAuth } from "../lib/https.js";
import { parseCallableData } from "../lib/validation.js";
import { submitSupportReport as submit } from "../services/supportSubmission.js";

export const submitSupportReport = onCall(async request => {
  const uid = requireAuth(request.auth?.uid);
  return submit(uid, parseCallableData(supportSubmissionSchema, request.data));
});
