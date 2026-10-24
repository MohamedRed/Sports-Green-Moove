import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import type { FirestoreRecord } from "./types";
import type { ReportStatus } from "./actions";

export type SupportReplyInput = { reportId: string; requestId: string; text: string; expectedStatus: ReportStatus;
  expectedReplyCount: number; status: "reviewing" | "closed" };
export type SupportReplyIntent = { ownerUid: string; input: SupportReplyInput };

export function prepareSupportReply(report: FirestoreRecord, text: string, status: "reviewing" | "closed"): SupportReplyIntent {
  const ownerUid = auth?.currentUser?.uid;
  if (!ownerUid) throw new Error("Veuillez vous reconnecter.");
  if (typeof report.reporterUserId !== "string" || !["booking", "rideSession", "message", "user", "other"].includes(String(report.subjectType)))
    throw new Error("Ce rapport ne permet pas une réponse au demandeur.");
  const count = report.publicReplyCount ?? 0;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || !["open", "reviewing", "closed"].includes(String(report.status)))
    throw new Error("La demande doit être actualisée.");
  const clean = text.trim(); if (!clean || clean.length > 2000) throw new Error("Rédigez une réponse de 1 à 2 000 caractères.");
  return { ownerUid, input: { reportId: report.id, requestId: crypto.randomUUID(), text: clean,
    expectedStatus: report.status as ReportStatus, expectedReplyCount: count, status } };
}

export async function sendSupportReply(intent: SupportReplyIntent): Promise<void> {
  if (!functions || auth?.currentUser?.uid !== intent.ownerUid) throw new Error("Le compte a changé. Reconnectez-vous.");
  const response = await httpsCallable(functions, "respondToReport")(intent.input);
  if (auth?.currentUser?.uid !== intent.ownerUid) throw new Error("Le compte a changé. Reconnectez-vous.");
  const data = response.data as Record<string, unknown>;
  const reply = data.reply as Record<string, unknown> | undefined;
  if (data.reportId !== intent.input.reportId || typeof data.replyId !== "string" || !/^[a-f0-9]{64}$/.test(data.replyId) ||
      typeof data.reused !== "boolean" || data.status !== intent.input.status || reply?.id !== data.replyId ||
      reply?.text !== intent.input.text || reply?.sequence !== intent.input.expectedReplyCount + 1 ||
      typeof reply.sentAtMillis !== "number" || !Number.isSafeInteger(reply.sentAtMillis) || reply.sentAtMillis <= 0)
    throw new Error("La confirmation est incomplète. Vérifiez la réponse avant de recommencer.");
}

export function replyWasRejected(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return ["functions/invalid-argument", "functions/failed-precondition", "functions/permission-denied", "functions/not-found", "functions/unauthenticated"].includes(code);
}
