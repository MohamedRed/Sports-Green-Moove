import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertParentPhoneSearch } from '../scripts/qa/browserstack-parent-search-evidence.mjs';
import { validatePhoneEvidence } from '../partner-portal/phone-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = 'docs/release/evidence/browserstack-parent-search-2026-10-18/';
const json = (name) => JSON.parse(readFileSync(resolve(root, source, name), 'utf8'));
const records = () => ['results.json', 'fixture.json', 'checkpoint.json', 'connection-policy.json'].map(json);

test('reviewed physical search validation stays joined to isolated parent data and original captures', () => {
  assertParentPhoneSearch(...records());
  validatePhoneEvidence(root, { source: source + 'results.json' }, '2026-10-18');
});

test('selection and session proof cannot become a completed child booking, consent event or tracking test', () => {
  for (const flag of ['childBookingVerified', 'guardianConsentEventVerified', 'trackingVerified',
    'driverNativeUi', 'twoPhoneFlowVerified', 'paymentExercised', 'productionDataWritten', 'realMapsVerified', 'videoCaptured']) {
    const data = records(); data[0][flag] = true;
    assert.throws(() => assertParentPhoneSearch(...data), undefined, flag);
  }
});

test('a mismatched child, guardian, account or replay invalidates this evidence', () => {
  for (const mutate of [
    (d) => { d[1].runId = '0'.repeat(32); },
    (d) => { d[2].parentUserId = 'other-parent'; },
    (d) => { d[2].parentRoles = ['driver']; },
    (d) => { d[2].parentEmail = 'real@example.com'; },
    (d) => { d[2].children[0].id = 'other-child'; },
    (d) => { d[2].children[0].guardianUserIds = []; },
    (d) => { d[2].children = []; },
    (d) => { d[2].recordedAt = 'invalid'; },
    (d) => { d[2].recordedAt = '2026-10-17T00:00:00Z'; },
  ]) { const data = records(); mutate(data); assert.throws(() => assertParentPhoneSearch(...data)); }
});

test('any submitted booking or request receipt contradicts the blocked-search result', () => {
  for (const field of ['bookingCount', 'requestReceiptCount']) {
    const data = records(); data[2][field] = 1;
    assert.throws(() => assertParentPhoneSearch(...data));
  }
});

test('phone validation rejects expanded local access and a different capture sequence', () => {
  const data = records(); data[3].settings.forceLocal = true;
  assert.throws(() => assertParentPhoneSearch(...data));
  const other = records(); other[0].captures.reverse();
  assert.throws(() => assertParentPhoneSearch(...other));
});

test('website keeps earlier incomplete search dates under the later complete phone exchange', () => {
  const search = content.flows.find((flow) => flow.id === 'search');
  assert.equal(search.status, 'partial'); assert.equal(search.phone.checkedAt, '2026-10-18');
  assert.equal(search.ui.checkedAt, '2026-10-16');
  assert.equal(search.searchBookingPhone.checkedAt, '2026-10-24');
  assert.match(search.remaining, /plusieurs trajets.*classement.*coupures.*iPhone/);
  const navigation = content.flows.find((flow) => flow.id === 'navigation');
  assert.equal(navigation.status, 'partial'); assert.equal(navigation.ui.checkedAt, '2026-10-15');
  for (const flow of [search, navigation]) assert.equal(flow.phone.source, source + 'results.json');
});
