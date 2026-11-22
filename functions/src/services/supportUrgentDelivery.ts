import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../lib/firebase.js";
import { supportEmailLeaseMs, supportEmailWindowMs, supportMailConfigSchema, supportUrgentMessage,
  supportMailApiKeySchema, supportUrgentMessageSchema, type SupportUrgentMessage } from "../domain/supportUrgentEmail.js";
import { SupportMailError } from "./supportMailProvider.js";

type Sender = (message: SupportUrgentMessage, idempotencyKey: string) => Promise<string>;

export async function deliverUrgentSupportEmail(reportId: string, rawConfig: string, apiKey: string, send: Sender, now = () => Date.now()) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) throw new Error("Invalid support reference");
  const ref = firestore.collection("supportUrgentEmailOutbox").doc(reportId), leaseId = randomUUID();
  const claimed = await firestore.runTransaction(async transaction => {
    const [snapshot, report] = await transaction.getAll(ref, firestore.collection("reports").doc(reportId));
    if (!snapshot.exists) return null;
    const row = snapshot.data()!;
    if (row.kind !== "support-urgent" || row.reportId !== reportId || row.audience !== "support" ||
        !["queued", "sending", "accepted", "needs_configuration", "needs_review"].includes(row.status) ||
        !Number.isSafeInteger(row.attempts) || row.attempts < 0 || row.attempts >= Number.MAX_SAFE_INTEGER ||
        !report.exists || report.get("emergency") !== true || typeof report.get("reporterUserId") !== "string")
      throw new Error("Support email requires a matching urgent request");
    if (["accepted", "needs_review"].includes(row.status)) return null;
    if (row.status === "sending" && row.leaseUntil?.toMillis() > now()) throw new SupportMailError("temporary");
    if (row.firstAttemptAt && now() - row.firstAttemptAt.toMillis() >= supportEmailWindowMs) {
      transaction.update(ref, { status: "needs_review", lastError: "confirmation_window_expired", updatedAt: Timestamp.fromMillis(now()) });
      return null;
    }
    let message: SupportUrgentMessage;
    try {
      supportMailApiKeySchema.parse(apiKey);
      // Bind the recipient/content once; retries cannot silently send to a different address.
      message = row.message ? supportUrgentMessageSchema.parse(row.message) :
        supportUrgentMessage(reportId, supportMailConfigSchema.parse(JSON.parse(rawConfig)));
    } catch {
      transaction.update(ref, { status: "needs_configuration", lastError: "configuration_required", updatedAt: Timestamp.fromMillis(now()) });
      return null;
    }
    const attemptedAt = Timestamp.fromMillis(now());
    transaction.update(ref, { status: "sending", message, leaseId, leaseUntil: Timestamp.fromMillis(now() + supportEmailLeaseMs),
      firstAttemptAt: row.firstAttemptAt ?? attemptedAt, attempts: row.attempts + 1, updatedAt: attemptedAt });
    return { message, key: "support-urgent/" + reportId };
  });
  if (!claimed) return;
  let providerId: string | undefined, failure: SupportMailError | undefined;
  try { providerId = await send(claimed.message, claimed.key); }
  catch (error) { failure = error instanceof SupportMailError ? error : new SupportMailError("temporary"); }
  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.get("status") !== "sending" || snapshot.get("leaseId") !== leaseId) throw new SupportMailError("temporary");
    const updatedAt = Timestamp.fromMillis(now());
    if (!failure && providerId) transaction.update(ref, { status: "accepted", providerId, providerAcceptedAt: updatedAt, updatedAt, lastError: null });
    else transaction.update(ref, { status: failure?.kind === "configuration" ? "needs_configuration" : failure?.kind === "review" ? "needs_review" : "queued",
      lastError: failure?.kind ?? "temporary", updatedAt });
  });
  if (failure?.kind === "temporary") throw failure;
}
