export type RatingSubmission = { rideSessionId: string; ratedUserId: string; score: number; comment?: string };

export function matchesRatingSubmission(stored: Record<string, unknown>, uid: string, data: RatingSubmission): boolean {
  return stored.rideSessionId === data.rideSessionId && stored.authorUserId === uid &&
    stored.ratedUserId === data.ratedUserId && stored.score === data.score && stored.comment === (data.comment ?? null);
}
