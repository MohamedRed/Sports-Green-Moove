import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { membershipPageToken } from "./membershipPageToken";
import type { MembershipDecision, MembershipReviewGateway, ReviewClub, ReviewMembership, ReviewPage } from "./membershipReviewTypes";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse d'adhésion invalide.");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Donnée d'adhésion manquante.");
  return value;
}
function page<T>(value: unknown, decode: (item: Record<string, unknown>) => T): ReviewPage<T> {
  const data = record(value);
  if (!Array.isArray(data.items) || data.items.length > 20) {
    throw new Error("Page d'adhésions invalide.");
  }
  return { items: data.items.map((item) => decode(record(item))), nextCursor: membershipPageToken(data.nextCursor) };
}
function membership(data: Record<string, unknown>): ReviewMembership {
  if (typeof data.active !== "boolean" || !(data.name === null || typeof data.name === "string") ||
      !(data.teamName === null || typeof data.teamName === "string") ||
      !(data.reviewedByUserId === null || typeof data.reviewedByUserId === "string") ||
      !Array.isArray(data.allowedActions) || data.allowedActions.some((action) => !["approve", "reject"].includes(action))) {
    throw new Error("Donnée d'adhésion invalide.");
  }
  return { id: string(data.id), userId: string(data.userId), name: data.name as string | null,
    role: string(data.role), status: string(data.status), active: data.active, requestVersion: string(data.requestVersion),
    allowedActions: data.allowedActions as MembershipDecision[], reviewedByUserId: data.reviewedByUserId as string | null,
    teamName: data.teamName as string | null };
}
export function membershipReviewGateway(uid: string): MembershipReviewGateway {
  async function call(name: string, data: unknown): Promise<unknown> {
    if (!functions || auth?.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    const response = await httpsCallable(functions, name)(data);
    if (auth.currentUser?.uid !== uid) throw new Error("Session modifiée. Reconnectez-vous.");
    return response.data;
  }
  return {
    async clubs(cursor) { return page<ReviewClub>(await call("listMembershipReviewClubs", cursor ? { cursor } : {}),
      (item) => ({ id: string(item.id), name: string(item.name) })); },
    async members(clubId, cursor) { return page(await call("listClubMemberships", { clubId, ...(cursor ? { cursor } : {}) }), membership); },
    async decide(item, decision) {
      const response = record(await call("reviewClubMembership", { membershipId: item.id, decision, expectedVersion: item.requestVersion }));
      if (response.membershipId !== item.id || response.status !== (decision === "approve" ? "active" : "rejected") ||
          typeof response.reviewId !== "string" || !response.reviewId) throw new Error("Décision non confirmée.");
    },
  };
}
