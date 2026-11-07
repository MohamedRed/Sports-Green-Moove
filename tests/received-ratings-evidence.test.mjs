import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertReceivedRatingsEvidence, receivedRatingsFolder, receivedRatingsPhases, validateReceivedRatingsEvidence} from '../scripts/qa/received-ratings-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, receivedRatingsFolder);
const json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
function report() {
  return {summary: json('summary'), service: json('service'), first: json('first-preparation'), phone: json('phone/session-results'),
    observations: receivedRatingsPhases.map(phase => json('phone/' + phase + '-observed')), review: json('ui-review'),
    disposal: json('disposal'), window: json('review-window-gap'), units: json('android-unit-counts'), priorCi: json('prior-ci')};
}
test('original service and physical summary evidence retain the separate open window and native-gate failures', () => {
  assert.equal(validateReceivedRatingsEvidence(root).physicalDeviceCount, 1);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(content.receivedRatingsRecheck.checkedAt, '2026-10-29');
  assert.equal(flow.images.filter(row => row.file.startsWith('received-rating-')).length, 5);
  assert.match(flow.remaining, /iPhone/); assert.equal(flow.tour.length, 4);
  for (const name of ['empty-driver', 'historical-driver', 'updated-driver', 'parent', 'landscape']) {
    assert.equal(captures['received-rating-' + name], receivedRatingsFolder + 'captures/' + name + '.jpg');
    assert.match(flow.images.find(row => row.file === 'received-rating-' + name).alt, /capture de session du 29 octobre/);
  }
});
for (const [name, mutate] of [
  ['production deployment', row => {row.summary.productionDeployed = true;}],
  ['phone submission inflation', row => {row.summary.phoneRatingSubmissionProven = true;}],
  ['installed-byte inflation', row => {row.summary.installedBytesIndependentlyVerified = true;}],
  ['component execution inflation', row => {row.summary.componentTestsExecutedLocally = true;}],
  ['release inflation', row => {row.summary.releaseComplete = true;}],
  ['repaired pagination inflation', row => {row.summary.longReviewDiscoveryFixed = true;}],
  ['missing original failure', row => {row.first.completed = true;}],
  ['truncated average', row => {row.service.observations[0].result.count = 100;}],
  ['cross-account count', row => {row.observations[3].summaries.parent.count = 105;}],
  ['wrong received mean', row => {row.observations[2].summaries.driver.average = 5;}],
  ['invented empty score', row => {row.observations[4].summaries.manager.average = 0;}],
  ['missing phone observation', row => {row.review.historicalMeanAndCount = false;}],
  ['unclosed client', row => {row.phone.firestoreClientTerminated = false;}],
  ['live endpoint', row => {row.disposal.ports[0].available = false;}],
  ['hidden known gap', row => {row.window.observedDriverPrompts = 1;}],
  ['hidden native failure', row => {row.priorCi.fullNativeGatePassed = true;}],
]) test('rejects ' + name, () => {const row = report(); mutate(row); assert.throws(() => assertReceivedRatingsEvidence(row));});
