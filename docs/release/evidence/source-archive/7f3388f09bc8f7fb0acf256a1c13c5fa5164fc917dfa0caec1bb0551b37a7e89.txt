import type { ReviewPage, ReviewClub } from "./membershipReviewTypes";
import type { GuardianReview, GuardianStatus, GuardianDecision } from "./guardianReviewTypes";

export function guardianRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse de vérification invalide.");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Identité de vérification manquante.");
  return value;
}
export function guardianStatus(value: unknown): GuardianStatus {
  if (typeof value !== "string" || !["requested", "verified", "refused", "revoked", "withdrawn"].includes(value)) throw new Error("État de vérification invalide.");
  return value as GuardianStatus;
}
export function guardianPage<T>(value: unknown, decode: (item: Record<string, unknown>) => T): ReviewPage<T> {
  const data = guardianRecord(value);
  if (!Array.isArray(data.items) || data.items.length > 20 || !(data.nextCursor === null ||
      typeof data.nextCursor === "string" && data.nextCursor.length > 0 && data.nextCursor.length <= 2048)) {
    throw new Error("Page de vérifications invalide.");
  }
  const items = data.items.map((item) => decode(guardianRecord(item)));
  return { items, nextCursor: data.nextCursor as string | null };
}
export function guardianClub(item: Record<string, unknown>): ReviewClub {
  return { id: text(item.id), name: text(item.name) };
}
export function guardianReview(item: Record<string, unknown>, clubId: string, uid: string): GuardianReview {
  const status = guardianStatus(item.status);
  const validActions = status === "requested" ? ["verify", "refuse"] : status === "verified" ? ["revoke"] : [];
  if (item.clubId !== clubId || !Number.isSafeInteger(item.revision) || Number(item.revision) <= 0 ||
      typeof item.id !== "string" || !/^[a-f0-9]{64}$/.test(item.id) ||
      !Array.isArray(item.allowedActions) || new Set(item.allowedActions).size !== item.allowedActions.length ||
      item.allowedActions.some((action) => !validActions.includes(action)) ||
      item.parentUserId === uid && item.allowedActions.length > 0 ||
      [item.parentName, item.childName, item.clubName].some((value) => value !== null && (typeof value !== "string" || !value.trim()))) {
    throw new Error("Demande de vérification invalide.");
  }
  return { id: item.id, clubId, clubName: item.clubName as string | null,
    childId: text(item.childId), childName: item.childName as string | null,
    parentUserId: text(item.parentUserId), parentName: item.parentName as string | null,
    status, revision: item.revision as number, allowedActions: item.allowedActions as GuardianDecision[] };
}
