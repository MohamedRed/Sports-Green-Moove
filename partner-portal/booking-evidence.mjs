import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { validateBookingDecisionsPhone } from '../scripts/qa/booking-decisions-phone-evidence.mjs';
import { validateRetainedBookingNotices } from '../scripts/qa/booking-notice-evidence.mjs';
import { validateRetainedSearchBooking } from '../scripts/qa/search-booking-retained-evidence.mjs';
import { validateBookingRequestNoticeEvidence } from '../scripts/qa/booking-request-notice-evidence.mjs';
import { validateBookingRequestPhoneEvidence } from '../scripts/qa/booking-request-phone-evidence.mjs';
import { validateSearchBookingPhone } from '../scripts/qa/search-booking-phone-evidence.mjs';

export function validateBookingEvidence(root, flow) {
  if (flow.requestNoticeChecks) {
    assert.equal(flow.id, 'booking'); assert.equal(flow.status, 'partial');
    validateBookingRequestNoticeEvidence(root, flow.requestNoticeChecks);
  }
  for (const [record, validate, ids] of [
    [flow.searchBookingPhone, validateSearchBookingPhone, ['search', 'booking']],
    [flow.requestNoticePhone, validateBookingRequestPhoneEvidence, ['booking']],
    [flow.decisionPhone, validateBookingDecisionsPhone, ['booking']],
    [flow.noticeChecks, validateRetainedBookingNotices, ['booking']],
    [flow.searchBookingUi, validateRetainedSearchBooking, ['search', 'booking']],
  ]) {
    if (!record) continue;
    assert(ids.includes(flow.id)); assert.equal(flow.status, 'partial');
    const run = validate(root, record.source);
    assert.equal(run.testedAt.slice(0, 10), record.checkedAt);
    assert(record.checkedAt <= flow.checkedAt);
    if (record.checksums) assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  }
}
