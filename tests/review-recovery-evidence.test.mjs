import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {assertReviewRecovery, reviewRecoveryFolder, validateReviewRecovery} from '../scripts/qa/review-recovery-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewRecoveryFolder);
const read = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
const report = () => ({summary: read('summary'), service: read('service'), device: read('device-copy'),
  disposal: read('disposal'), units: read('android-unit-counts')});
test('recovery evidence proves scoped components and loopback faults without physical or whole-gate promotion', () => {
  assert.equal(validateReviewRecovery(root, content.reviewSubmissionRecovery).nativeComponentCases, 11);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone');
  assert.equal(flow.images.filter(row => !['review-network-phone-', 'review-receipt-phone-'].some(prefix => row.file.startsWith(prefix))).length, 38);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(row => row.image.startsWith('review-page-')));
  const images = flow.images.filter(row => row.file.startsWith('review-trip-network-')); assert.equal(images.length, 3);
  for (const row of images) {assert.match(row.alt, /simulation du 29 octobre/); assert(captures[row.file].startsWith(reviewRecoveryFolder));}
  assert.match(flow.remaining, /iPhone/);
  assert(content.blockers.some(row => row.id === 'native-current-gate'));
});
for (const key of ['physicalNetworkLossProven', 'physicalDeviceTested', 'iosUiExecuted', 'productionDeployed',
  'productionWrites', 'fullNativeGatePassed', 'releaseComplete']) test('refuses promotion of ' + key, () => {
  const row = report(); row.summary[key] = true; assert.throws(() => assertReviewRecovery(row));
});
for (const [name, mutate] of [
  ['a missing service group', row => row.service.checks.pop()],
  ['a duplicated service group', row => {row.service.checks[1].id = row.service.checks[0].id;}],
  ['a failed service group', row => {row.service.checks[0].status = 'failed';}],
  ['a commit supposedly forwarded before disconnection', row => {row.service.attempts[0].upstreamAcknowledged = true;}],
  ['a post-commit loss without an upstream acknowledgement', row => {row.service.attempts[2].upstreamAcknowledged = false;}],
  ['a retry for another trip', row => {row.service.attempts[3].rideSessionId = 'other';}],
  ['unverified installed bytes', row => {row.device.installedBytesVerified = false;}],
  ['an open local endpoint', row => {row.disposal.endpointsClosed = false;}],
  ['an emulator left running', row => {row.disposal.ownedEmulatorProcessAbsent = false;}],
  ['a failed Android unit case', row => {row.units.failures = 1;}],
]) test('refuses ' + name, () => {const row = report(); mutate(row); assert.throws(() => assertReviewRecovery(row));});
