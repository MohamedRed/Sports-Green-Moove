import { buildInboxReviewPrompts, type InboxDocument, type ClientInboxReviewPrompt } from "./inbox.js";

export const REVIEW_PAGE_SIZE = 20;
export const REVIEW_SCAN_SIZE = 100;
export type PendingReviewSelection = { items: ClientInboxReviewPrompt[]; lastScannedId: string | null; hasMore: boolean };

export function selectPendingReviews(
  rides: readonly InboxDocument[], authoredRatingIds: ReadonlySet<string>, uid: string,
): PendingReviewSelection {
  const items: ClientInboxReviewPrompt[] = [];
  let scanned = 0;
  for (const ride of rides.slice(0, REVIEW_SCAN_SIZE)) {
    scanned += 1;
    items.push(...buildInboxReviewPrompts([ride], authoredRatingIds, uid));
    if (items.length === REVIEW_PAGE_SIZE) break;
  }
  return { items, lastScannedId: scanned ? rides[scanned - 1].id : null, hasMore: scanned < rides.length };
}
