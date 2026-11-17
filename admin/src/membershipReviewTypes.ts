export type MembershipDecision = "approve" | "reject";
export type ReviewClub = { id: string; name: string };
export type ReviewMembership = {
  id: string; userId: string; name: string | null; role: string; status: string; active: boolean;
  requestVersion: string; allowedActions: MembershipDecision[]; reviewedByUserId: string | null; teamName: string | null;
};
export type ReviewPage<T> = { items: T[]; nextCursor: string | null };
export interface MembershipReviewGateway {
  clubs(cursor?: string): Promise<ReviewPage<ReviewClub>>;
  members(clubId: string, cursor?: string): Promise<ReviewPage<ReviewMembership>>;
  decide(item: ReviewMembership, decision: MembershipDecision): Promise<void>;
}
