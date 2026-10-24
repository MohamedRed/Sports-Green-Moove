import type { ReviewClub, ReviewPage } from "./membershipReviewTypes";

export type GuardianDecision = "verify" | "refuse" | "revoke";
export type GuardianStatus = "requested" | "verified" | "refused" | "revoked" | "withdrawn";
export type GuardianReview = {
  id: string; clubId: string; clubName: string | null; childId: string; childName: string | null;
  parentUserId: string; parentName: string | null; status: GuardianStatus; revision: number;
  allowedActions: GuardianDecision[];
};
export type GuardianOperation = {
  clubId: string; childId: string; parentUserId: string; action: GuardianDecision;
  expectedRevision: number; requestId: string;
};
export interface GuardianReviewGateway {
  clubs(cursor?: string): Promise<ReviewPage<ReviewClub>>;
  requests(clubId: string, cursor?: string): Promise<ReviewPage<GuardianReview>>;
  decide(item: GuardianReview, operation: GuardianOperation): Promise<GuardianStatus>;
}
export const guardianStatusLabels: Record<GuardianStatus, string> = {
  requested: "En attente", verified: "Parent vérifié", refused: "Demande refusée", revoked: "Vérification retirée", withdrawn: "Demande retirée",
};
