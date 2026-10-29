import assert from 'node:assert/strict';
import {readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {assertReviewPaginationEvidence, reviewPaginationFolder, reviewPaginationPhases, reviewPaginationPublicCaptures,
  validateReviewPaginationEvidence} from '../scripts/qa/review-pagination-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewPaginationFolder);
const json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
function report() {
  return {summary: json('summary'), service: json('service'), first: json('first-preparation'), phone: json('phone/session-results'),
    observations: reviewPaginationPhases.map(phase => json('phone/' + phase)), review: json('ui-review'),
    disposal: json('disposal'), units: json('android-unit-counts')};
}
test('new 31-ride phone and 320-ride service proof close the gap without replacing older failure evidence', () => {
  const result = validateReviewPaginationEvidence(root);
  assert.equal(result.phoneRatingSubmissionsIndependentlyObserved, 2);
  const old = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/received-ratings-2026-10-29/review-window-gap.json')));
  assert.equal(old.gapReproduced, true); assert.equal(old.observedDriverPrompts, 0); assert.equal(old.observedParentPrompts, 30);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-29'); assert.equal(flow.tour.length, 4);
  assert(flow.tour.every(row => row.image.startsWith('review-page-')));
  assert.match(flow.remaining, /trajet concerné/); assert.match(flow.remaining, /coupure/);
  assert(!content.blockers.some(row => row.id === 'review-history-window'));
  assert(content.blockers.some(row => row.id === 'review-trip-context'));
  assert.equal(flow.images.filter(row => row.file.startsWith('received-rating-')).length, 5);
  assert.equal(flow.images.filter(row => row.file.startsWith('review-history-')).length, 7);
  for (const name of reviewPaginationPublicCaptures) {
    assert.equal(captures['review-page-' + name], reviewPaginationFolder + 'captures/' + name + '.jpg');
    assert.match(flow.images.find(row => row.file === 'review-page-' + name).alt, /capture de session du 29 octobre/);
  }
});
for (const [name, mutate] of [
  ['production deployment', row => {row.summary.productionDeployed = true;}],
  ['release completion', row => {row.summary.releaseComplete = true;}],
  ['native screenshot export', row => {row.summary.publicCaptureMethod = 'native-export';}],
  ['installed-byte verification', row => {row.summary.installedBytesIndependentlyVerified = true;}],
  ['component execution', row => {row.summary.componentTestsExecutedLocally = true;}],
  ['iOS UI verification', row => {row.summary.iosUiExecuted = true;}],
  ['phone fixture-submission inflation', row => {row.phone.subsequentRatingsFixtureSubmitted = true;}],
  ['missing initial failure', row => {row.first.completed = true;}],
  ['same failed and passed run', row => {row.first.runId = row.service.runId;}],
  ['truncated parent discovery', row => {row.service.observations.parent.requests = 30;}],
  ['missing empty continuation', row => {row.service.observations.driver.emptyContinuationPages = 0;}],
  ['another account inheriting requests', row => {row.observations[2].parentRequests = 0;}],
  ['fixture supplied phone review', row => {row.observations[1].immutableRatingCount = 30;}],
  ['second page reset after submission', row => {row.review.remainingBadge30WithoutFirstPageReset = false;}],
  ['unclosed account client', row => {row.phone.firestoreClientTerminated = false;}],
  ['active helper', row => {row.disposal.helperProcessAbsent = false;}],
  ['still-open test service', row => {row.disposal.ports[0].available = false;}],
  ['wrong APK', row => {row.phone.sourceApkSha256 = '0'.repeat(64);}],
]) test('rejects ' + name, () => {const row = report(); mutate(row); assert.throws(() => assertReviewPaginationEvidence(row));});
test('a changed original capture fails bundle verification', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-review-page-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, resolve(temp, reviewPaginationFolder), {recursive: true});
  writeFileSync(resolve(temp, reviewPaginationFolder, 'captures/driver-sent.jpg'), 'not the original image');
  assert.throws(() => validateReviewPaginationEvidence(temp), /driver-sent.jpg/);
});
