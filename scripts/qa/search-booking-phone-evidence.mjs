import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertSearchBookingCheckpoint } from './search-booking-checkpoint.mjs';
import { verifySearchBookingIsolation } from './search-booking-records.mjs';
import { searchMapsPolicy, searchOperations } from './search-maps-policy.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const searchPhoneCaptures = ['choices', 'match', 'requested', 'driver-approved', 'parent-approved', 'cancelled', 'capacity-restored'];

export function validateSearchBookingPhone(root, source) {
  const base = dirname(resolve(root, source)), json = file => JSON.parse(readFileSync(resolve(base, file)));
  const summary = json('summary.json'), phone = json('phone-records.json'), baseline = json('baseline.json');
  assert.equal(summary.scope, 'physical-android-child-search-two-seat-booking-isolated-not-production');
  assert.equal(summary.physicalDevice, true); assert.equal(summary.uiObservation, 'manual-native-ui');
  assert.equal(summary.appAndBackendDiffToApkSourceEmpty, true);
  assert.equal(summary.checkedAt, '2026-10-24'); assert.equal(summary.testedAt, phone.recordedAt);
  assert.equal(summary.testedAt.slice(0, 10), summary.checkedAt);
  assert.equal(summary.requestedSeats, 2); assert.equal(summary.childId, 'sgm-qa-child-lina');
  assert.deepEqual(summary.capacitySequence, [4, 4, 2, 2, 4]);
  for (const key of ['parentRequestedInApp', 'driverApprovedInApp', 'parentCancelledInApp']) assert.equal(summary[key], true);
  for (const key of ['productionWrites', 'productionDeployed', 'simultaneousPhones', 'physicalTracking',
    'wholeProcessRestart', 'realPayment', 'iosTested', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(phone.scope, 'independent-search-booking-phone-records-not-ui-proof');
  assert.equal(phone.physicalUiProven, false); assert.equal(phone.completed, true);
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.runId, baseline.runId);
  for (const key of ['productionWrites', 'realPayment']) assert.equal(phone[key], false);
  const phases = ['requested', 'approved', 'parent-returned', 'cancelled'];
  assert.equal(summary.independentCheckpoints, phases.length);
  assert.deepEqual(phone.checkpoints.map(row => row.phase), phases);
  for (const [index, phase] of phases.entries()) {
    const row = json(phase + '.json'); assert.equal(row.phase, phase);
    const result = assertSearchBookingCheckpoint(phase === 'parent-returned' ? 'approved' : phase,
      row.state, {tripId: baseline.fixture.tripId, bookingId: phone.bookingId});
    assert.deepEqual(row.result, result); assert.deepEqual(phone.checkpoints[index].result, result);
  }
  assert.deepEqual(phone.isolation, verifySearchBookingIsolation(baseline.baseline, json('final-state.json'),
    {tripId: baseline.fixture.tripId, bookingId: phone.bookingId}));
  const provider = json('provider.json'), allowance = json('allowance.json');
  assert.equal(allowance.approval, '2026-10-24-one-phone-trial-max-eight'); assert.equal(allowance.approvedRequests, 8);
  assert.equal(allowance.matrixElements, 9); assert.equal(allowance.retriesApproved, false);
  assert.equal(provider.policy, searchMapsPolicy); assert.equal(provider.approvedRequestLimit, 8); assert.equal(provider.stopped, false);
  assert.equal(summary.actualMapRequests, 6); assert.equal(summary.approvedMapRequestLimit, 8); assert.equal(summary.matrixElements, 9);
  assert.deepEqual(provider.requests.map(row => row.operation), searchOperations);
  assert(provider.requests.every(row => row.completed && row.status === 200));
  assert.deepEqual(provider.facts.map(row => row.operation), searchOperations); assert.equal(provider.facts[4].elements.length, 9);
  const green = json('services-green.json'), red = json('services-red.json');
  assert.equal(green.completed, true); assert.equal(green.checks.length, 6); assert(green.checks.every(row => row.status === 'passed'));
  assert.equal(red.completed, false); assert.equal(red.checks.length, 0); assert.equal(red.failure.name, 'AssertionError');
  assert.match(red.failure.message, /bookingRequested/); assert.match(red.failure.message, /sgm-qa-driver/);
  assert.equal(red.sourceFiles['scripts/qa/search-booking-notice-services-suite.mjs'], green.sourceFiles['scripts/qa/search-booking-notice-services-suite.mjs']);
  for (const report of [red, green]) {
    assert.equal(report.providerRequests, 0); assert.equal(report.nativeUiExecuted, false);
    assert.equal(report.productionWrites, false); assert.equal(report.releaseComplete, false);
    assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
  }
  for (const report of [red, green, phone]) assertRetainedSourceFiles(root, report.sourceFiles);
  const apk = json('apk.json'); assert.equal(apk.sourceCommit, summary.apkSourceCommit);
  assert.equal(apk.packageId, 'be.sportgreenmoove.app.local'); assert.equal(apk.host, '127.0.0.1'); assert.equal(apk.projectId, phone.projectId);
  const cleanup = json('phone-cleanup.json'), runtime = json('runtime-cleanup.json');
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed', 'providerBrokerClosed']) assert.equal(runtime[key], true);
  assert.equal(runtime.failed, false);
  for (const key of ['signedOut', 'uninstallAcknowledged', 'sessionStopped', 'observerExited', 'privateSessionAbsent',
    'runtimeAbsent', 'helperDirectoryAbsent', 'helperProcessAbsent', 'portsClosed']) assert.equal(cleanup[key], true, key);
  assert.equal(cleanup.observerExitCode, 0); assert.equal(cleanup.runtimeExitCode, 0); assert.equal(cleanup.helperExitCode, 130);
  for (const key of ['administrationUsed', 'installationPolicyChanged', 'packageAbsenceIndependentlyVerified']) assert.equal(cleanup[key], false);
  const review = json('visual-review.json'); assert.equal(review.reviewed, true);
  assert.equal(review.containsRealCustomerData, false); assert.equal(review.credentialsVisible, false);
  assert.deepEqual(Object.keys(review.published).sort(), searchPhoneCaptures.map(name => name + '.png').sort());
  assert.equal(summary.originalCaptures, searchPhoneCaptures.length);
  assert(Object.values(review.published).every(value => value === true));
  assertEvidenceBundleChecksums(base); return summary;
}
