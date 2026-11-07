import { membershipPageToken } from "./membershipPageToken";
import type { ReviewPage } from "./membershipReviewTypes";
import type { ReviewTeam, TeamDecision, TeamOperation, TeamReview, TeamReviewPage, TeamStatus } from "./teamReviewTypes";

export function teamRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse d'inscription invalide.");
  return value as Record<string, unknown>;
}
export function teamDocumentId(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 256 || value.includes("/") ||
      value === "." || value === ".." || /^__.*__$/.test(value)) throw new Error("Identité d'inscription invalide.");
  return value;
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("Identité d'inscription invalide.");
  return value;
}
function label(value: unknown): string | null {
  if (value !== null && (typeof value !== "string" || !value.trim() || value.length > 120 ||
      /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value))) throw new Error("Nom d'inscription invalide.");
  return value as string | null;
}
export function teamStatus(value: unknown): TeamStatus {
  if (typeof value !== "string" || !["requested", "approved", "refused", "withdrawn", "revoked"].includes(value)) throw new Error("État d'inscription invalide.");
  return value as TeamStatus;
}
export function teamPage<T extends { id: string }>(value: unknown, decode: (row: Record<string, unknown>) => T): ReviewPage<T> {
  const data = teamRecord(value);
  if (!Array.isArray(data.items) || data.items.length > 20) throw new Error("Page d'inscriptions invalide.");
  const items = data.items.map((item) => decode(teamRecord(item)));
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Page d'inscriptions répétée.");
  return { items, nextCursor: membershipPageToken(data.nextCursor) };
}
export function reviewTeam(row: Record<string, unknown>, clubId: string): ReviewTeam {
  if (row.clubId !== clubId || typeof row.open !== "boolean") throw new Error("Équipe non confirmée.");
  return { id: teamDocumentId(row.id), clubId, teamInstanceId: digest(row.teamInstanceId), name: label(row.name), open: row.open };
}
export function teamReview(row: Record<string, unknown>, team: ReviewTeam): TeamReview {
  const status = teamStatus(row.status), allowed = status === "requested" ? ["approve", "refuse"] : status === "approved" ? ["revoke"] : [];
  const name = label(row.subjectName);
  if (row.clubId !== team.clubId || row.teamId !== team.id || row.teamInstanceId !== team.teamInstanceId ||
      row.subjectKind !== "member" && row.subjectKind !== "child" || !Number.isSafeInteger(row.revision) || Number(row.revision) <= 0 ||
      !Array.isArray(row.allowedActions) || new Set(row.allowedActions).size !== row.allowedActions.length ||
      row.allowedActions.some((action) => !allowed.includes(action)) || row.allowedActions.includes("approve") && name === null)
    throw new Error("Inscription non confirmée. Actualisez les équipes.");
  return { id: digest(row.id), clubId: team.clubId, teamId: team.id, teamInstanceId: team.teamInstanceId,
    subjectKind: row.subjectKind as TeamReview["subjectKind"], subjectId: teamDocumentId(row.subjectId), subjectName: name,
    status, revision: row.revision as number, allowedActions: row.allowedActions as TeamDecision[] };
}
export function teamReviewPage(value: unknown, team: ReviewTeam): TeamReviewPage {
  const data = teamRecord(value);
  if (data.teamId !== team.id || data.teamInstanceId !== team.teamInstanceId) throw new Error("L'équipe a changé. Actualisez les équipes.");
  return { ...teamPage(data, (row) => teamReview(row, team)), teamName: label(data.teamName) };
}
export function teamDecisionStatus(value: unknown, item: TeamReview, operation: TeamOperation): TeamStatus {
  const data = teamRecord(value);
  if (data.enrollmentId !== item.id || data.teamId !== item.teamId || data.teamInstanceId !== item.teamInstanceId ||
      !Number.isSafeInteger(data.revision) || Number(data.revision) <= item.revision || typeof data.replayed !== "boolean" ||
      !data.replayed && (data.revision !== item.revision + 1 || data.status !==
        { approve: "approved", refuse: "refused", revoke: "revoked" }[operation.action]))
    throw new Error("Décision non confirmée.");
  return teamStatus(data.status);
}
