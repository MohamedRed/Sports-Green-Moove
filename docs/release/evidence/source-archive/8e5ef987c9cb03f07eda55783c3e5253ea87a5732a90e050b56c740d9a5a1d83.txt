import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { defineSecret } from "firebase-functions/params";
import { deliverUrgentSupportEmail } from "./services/supportUrgentDelivery.js";
import { sendSupportUrgentEmail } from "./services/supportMailProvider.js";
import { requireAdmin, requireAuth } from "./lib/https.js";
import { parseCallableData } from "./lib/validation.js";
import { firestore } from "./lib/firebase.js";

const apiKey = defineSecret("SUPPORT_EMAIL_API_KEY"), mailConfig = defineSecret("SUPPORT_EMAIL_CONFIG");
const secrets = [apiKey, mailConfig];
const deliver = (reportId: string) => deliverUrgentSupportEmail(reportId, mailConfig.value(), apiKey.value(),
  (message, key) => sendSupportUrgentEmail(message, key, apiKey.value()));

export const sendUrgentSupportEmail = onDocumentCreated({ document: "supportUrgentEmailOutbox/{reportId}", secrets, retry: true },
  event => deliver(event.params.reportId));

export const retryUrgentSupportEmail = onCall({ secrets }, async request => {
  requireAuth(request.auth?.uid); requireAdmin(request.auth?.token);
  const { reportId } = parseCallableData(z.object({ reportId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).strict(), request.data);
  const ref = firestore.collection("supportUrgentEmailOutbox").doc(reportId);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Demande urgente introuvable.");
  try { await deliver(reportId); }
  catch { throw new HttpsError("unavailable", "L’envoi de l’e-mail reste à vérifier."); }
  return { reportId, status: (await ref.get()).get("status") };
});
