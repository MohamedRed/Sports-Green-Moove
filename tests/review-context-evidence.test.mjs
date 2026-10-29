import assert from 'node:assert/strict';
import {readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {assertReviewContextEvidence, reviewContextFolder, reviewContextCaptures, validateReviewContextEvidence} from '../scripts/qa/review-context-evidence.mjs';
import {validateReviewBaselineGate} from '../scripts/qa/review-baseline-gate-evidence.mjs';
import {validateContextReplayEvidence} from '../scripts/qa/review-context-replay-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewContextFolder);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
const report = () => ({summary: json('summary'), service: json('service'), units: json('android-unit-counts'), device: json('device-copy'), disposal: json('disposal')});
test('the local context proof stays separate from the later partial phone attempt and preserves earlier galleries', () => {
  assert.equal(validateReviewContextEvidence(root).nativeComponentCases, 9);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'local'); assert.equal(flow.images.length, 38);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(row => row.image.startsWith('review-page-')));
  assert.match(flow.remaining, /reconnexion/); assert.match(flow.remaining, /coupure/);
  assert.equal(flow.images.filter(row => row.file.startsWith('review-history-')).length, 7);
  assert.equal(flow.images.filter(row => row.file.startsWith('received-rating-')).length, 5);
  for (const name of reviewContextCaptures) assert.equal(captures['review-trip-' + name], reviewContextFolder + 'review-trip-context-' + name + '.png');
});
test('the earlier gate stays distinct from the later context implementation own matching gate', () => {
  const baseline = validateReviewBaselineGate(root, content.reviewBaselineGateRecheck);
  assert.equal(baseline.nativeGatePassed, true); assert.equal(baseline.newReviewContextCovered, false);
  assert.equal(json('summary').fullNativeGatePassedForThisImplementation, false);
  assert.equal(validateContextReplayEvidence(root).gate.contextualComponentCases, 3);
  assert(!content.blockers.some(row => row.id === 'native-primary-capture'));
});
for (const [name, mutate] of [
  ['physical-phone promotion', row => {row.summary.physicalDeviceTested = true;}],
  ['native/service integration promotion', row => {row.summary.nativeServiceIntegrationVerified = true;}],
  ['process restart promotion', row => {row.summary.processRestartProven = true;}],
  ['full gate promotion', row => {row.summary.fullNativeGatePassedForThisImplementation = true;}],
  ['iOS UI promotion', row => {row.summary.iosUiExecuted = true;}],
  ['release promotion', row => {row.summary.releaseComplete = true;}],
  ['incomplete service replay', row => {row.service.completed = false;}],
  ['lost unavailable reviews', row => {row.service.observations.pagination.unavailableRequestsPerAccount = 0;}],
  ['wrong request removed', row => {row.service.observations.submission.parentRemaining = 30;}],
  ['another account changed', row => {row.service.observations.submission.driverUnchanged = false;}],
  ['provider call', row => {row.service.providerRequests = 1;}],
  ['missing source-byte check', row => {row.device.records[0].installedBytesVerified = false;}],
  ['unclosed runtime', row => {row.service.isolatedEnvironmentDestroyed = false;}],
  ['unclosed device', row => {row.disposal.ownedEmulatorProcessAbsent = false;}],
]) test('rejects ' + name, () => {const value = report(); mutate(value); assert.throws(() => assertReviewContextEvidence(value));});
test('an altered native capture fails even when the other reports remain valid', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-review-context-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, resolve(temp, reviewContextFolder), {recursive: true});
  writeFileSync(resolve(temp, reviewContextFolder, 'review-trip-context-choices.png'), 'not original');
  assert.throws(() => validateReviewContextEvidence(temp), /review-trip-context-choices.png/);
});
