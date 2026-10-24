import type { ReviewClub, ReviewPage } from "./membershipReviewTypes";

export type TeamDecision = "approve" | "refuse" | "revoke";
export type TeamStatus = "requested" | "approved" | "refused" | "withdrawn" | "revoked";
export type ReviewTeam = { id: string; clubId: string; teamInstanceId: string; name: string | null; open: boolean };
export type TeamReview = {
  id: string; clubId: string; teamId: string; teamInstanceId: string;
  subjectKind: "member" | "child"; subjectId: string; subjectName: string | null;
  status: TeamStatus; revision: number; allowedActions: TeamDecision[];
};
export type TeamOperation = { enrollmentId: string; action: TeamDecision; expectedRevision: number; requestId: string };
export type TeamReviewPage = ReviewPage<TeamReview> & { teamName: string | null };
export interface TeamReviewGateway {
  clubs(cursor?: string): Promise<ReviewPage<ReviewClub>>;
  teams(clubId: string, cursor?: string): Promise<ReviewPage<ReviewTeam>>;
  requests(team: ReviewTeam, cursor?: string): Promise<TeamReviewPage>;
  decide(item: TeamReview, operation: TeamOperation): Promise<TeamStatus>;
}
export const teamStatusLabels: Record<TeamStatus, string> = {
  requested: "En attente", approved: "Inscription approuvée", refused: "Demande refusée",
  withdrawn: "Demande retirée", revoked: "Inscription retirée",
};
