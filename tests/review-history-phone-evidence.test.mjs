import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertReviewPhoneEvidence, reviewPhoneDirectory, validateReviewPhoneEvidence} from '../scripts/qa/review-history-phone-evidence.mjs';
import {reviewPhonePhases} from '../scripts/qa/review-history-phone-checkpoints.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewPhoneDirectory);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
function report() {
  return {summary: json('summary'), session: json('records/session-results'), fixture: json('records/fixture'),
    observations: reviewPhonePhases.map(phase => json('records/' + phase + '-observed')), review: json('ui-review'), disposal: json('disposal')};
}
test('retained phone review history has seven original captures and independent stored checkpoints', () => {
  assert.equal(validateReviewPhoneEvidence(root).completedCheckpoints, 7);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(content.reviewHistoryPhone.checkedAt, '2026-10-29'); assert.equal(flow.status, 'partial'); assert.equal(flow.tour.length, 4);
  assert.match(flow.remaining, /iPhone/);
  assert.equal(flow.images.filter(row => row.file.startsWith('review-history-')).length, 7);
  for (const phase of reviewPhonePhases) {
    assert.equal(captures['review-history-' + phase], reviewPhoneDirectory + 'captures/' + phase + '.jpg');
    assert.match(flow.images.find(row => row.file === 'review-history-' + phase).alt, /capture de session du 29 octobre/);
  }
});
for (const [name, mutate] of [
  ['process restart inflation', row => {row.summary.processRestartProven = true;}],
  ['received-rating inflation', row => {row.summary.receivedRatingsProven = true;}],
  ['installed-byte inflation', row => {row.summary.installedBytesIndependentlyVerified = true;}],
  ['production inflation', row => {row.summary.productionWrites = true;}],
  ['release inflation', row => {row.summary.releaseComplete = true;}],
  ['missing phone observation', row => {row.review.driverSentFiveStars = false;}],
  ['unclosed session', row => {row.session.adminClientClosed = false;}],
  ['duplicate stored review', row => {row.observations[2].state.ratings.push(row.observations[2].state.ratings[0]);}],
  ['modified original timestamp', row => {row.observations[6].state.ratings[0].createdAt = 'changed';}],
  ['returned review', row => {row.observations[3].state.driverInbox.reviews = row.observations[1].state.driverInbox.reviews;}],
  ['cross-run observation', row => {row.observations[4].runId = 'different';}],
  ['reordered observation time', row => {row.observations[4].observedAt = row.observations[0].observedAt;}],
  ['live endpoint', row => {row.disposal.ports[0].available = false;}],
]) test('rejects ' + name, () => {const row = report(); mutate(row); assert.throws(() => assertReviewPhoneEvidence(row));});
