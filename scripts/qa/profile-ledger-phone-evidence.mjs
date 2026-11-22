import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { profileLedgerPhonePhases, verifyProfileLedgerPhoneState } from './profile-ledger-phone-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateProfileLedgerPhoneEvidence(root, record) {
  const base = dirname(resolve(root, record.source));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const json = file => JSON.parse(readFileSync(resolve(base, file)));
  const summary = json('summary.json'), session = json('session-results.json'), first = json('baseline.json');
  assert.equal(summary.scope, 'physical-android-profile-ledger-with-isolated-data-not-production');
  assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(summary.physicalDevice, true); assert.equal(summary.uiObservation, 'manual-native-ui');
  assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.equal(session.completed, true);
  assert.equal(session.scope, 'independent-profile-ledger-phone-records-not-ui-proof');
  assert.equal(session.physicalUiProven, false);
  for (const key of ['wholeProcessRestartProven', 'realPaymentProven', 'productionWrites']) assert.equal(session[key], false);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(session[key], true);
  assert.equal(session.testedAt.slice(0, 10), record.checkedAt);
  assert.equal(session.runId, first.runId); assert.deepEqual(session.fixture, first.fixture);
  assert.equal(first.fixture.parentLedger.rewards.balanceCents, -22_000);
  assert.equal(first.fixture.parentLedger.impact.rideCount, 258);
  assert.equal(first.fixture.driverLedger.rewards.balanceCents, 1_000_249);
  let previous;
  const accepted = profileLedgerPhonePhases.map(phase => {
    const row = json(phase + '.json'); assert.equal(row.runId, session.runId);
    assert.equal(row.projectId, session.projectId);
    const result = verifyProfileLedgerPhoneState(phase, first.baseline, row.state, first.fixture, previous);
    assert.deepEqual(row.result, result); previous = row.state; return result;
  });
  assert.deepEqual(session.checkpoints, accepted);
  assertRetainedSourceFiles(root, session.sourceFiles);
  const apk = json('apk.json'); assert.equal(apk.sourceCommit, summary.sourceCommit);
  assert.equal(apk.packageId, 'be.sportgreenmoove.app.local'); assert.equal(apk.host, '127.0.0.1');
  assert.equal(apk.projectId, session.projectId); assert.match(apk.apkSha256, /^[a-f0-9]{64}$/);
  const review = json('visual-review.json'); assert.equal(review.reviewed, true);
  assert.equal(review.containsRealCustomerData, false); assert.equal(review.credentialsVisible, false);
  assert.equal(Object.keys(review.published).length, 7); assert(Object.values(review.published).every(value => value === true));
  const cleanup = json('cleanup.json');
  for (const key of ['signedOut', 'uninstallAcknowledged', 'sessionStopped', 'observerExited', 'privateSessionAbsent',
    'runtimeAbsent', 'helperDirectoriesAbsent', 'ownedHelperAbsent', 'portsClosed']) assert.equal(cleanup[key], true, key);
  for (const key of ['administrationUsed', 'installationPolicyChanged', 'packageAbsenceIndependentlyVerified']) assert.equal(cleanup[key], false);
  for (const key of ['productionDeployed', 'releaseComplete', 'wholeProcessRestart', 'physicalTracking', 'realPayment', 'iosTested'])
    assert.equal(summary[key], false, key);
  assertEvidenceBundleChecksums(base);
  return summary;
}
