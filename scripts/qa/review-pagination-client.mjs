import assert from 'node:assert/strict';
import {call} from './local-flow-client.mjs';

export async function collectPendingReviews(actor, initialInbox = true) {
  const pages = [], items = [], seen = new Set(), cursors = new Set();
  let cursor;
  do {
    let page;
    if (pages.length === 0 && initialInbox) {
      const {inbox} = await call('getInbox', actor);
      page = {userId: inbox.reviewsUserId, items: inbox.reviews, nextCursor: inbox.reviewsNextCursor};
    } else page = await call('getPendingReviews', actor, cursor ? {cursor} : {});
    assert.equal(page.userId, actor.uid); assert(page.items.length <= 20);
    for (const item of page.items) {
      assert(!seen.has(item.id), 'A review must occur in only one page'); seen.add(item.id); items.push(item);
    }
    pages.push(page); cursor = page.nextCursor;
    assert(cursor === null || typeof cursor === 'string');
    if (cursor) {assert(!cursors.has(cursor), 'Review pagination must progress'); cursors.add(cursor);}
    assert(pages.length <= 100, 'Fixture traversal exceeded its expected bounded test size');
  } while (cursor);
  return {items, pages};
}
