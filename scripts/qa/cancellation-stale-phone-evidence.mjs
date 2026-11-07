import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {staleCancellationPhonePhases, verifyPeerApproval} from './cancellation-stale-phone-checkpoints.mjs';
import {normalizeCancellationProfiles, verifyCancellationWithCapacity} from './trip-cancellation-phone-checkpoints.mjs';

export const staleCancellationFolder = 'docs/release/evidence/cancellation-stale-phone-2026-10-30/';
export const staleCancellationPublicImages = ['preview-before-peer', 'stale-confirmation', 'preview-refreshed', 'cancellation-confirmed', 'driver-history'];
export function validateStaleCancellationPhone(root) {
  const base = resolve(root, staleCancellationFolder), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(base);
  const report = json('records/session-results.json'), baseline = json('records/baseline.json'), summary = json('summary.json');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.runId, baseline.runId); assert.equal(report.completed, true); assert.equal(report.failure, null);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['physicalUiProven', 'concurrentTransactionOverlapProven', 'phoneWireAbortedCodeProven',
    'pushDeliveryVerified', 'productionWrites', 'realPaymentExercised']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assert.deepEqual(report.checkpoints.map(row => row.phase), staleCancellationPhonePhases);
  assertRetainedSourceFiles(root, report.sourceFiles); assertRetainedSourceFiles(root, json('handoff-source-sha256.json'));
  const fixture = baseline.fixture, initial = baseline.baseline, peer = json('records/peer-approved.json').state;
  assert.deepEqual(report.fixture, fixture); verifyPeerApproval(initial, peer, fixture);
  const changed = json('records/changed-preview.json'); assert.deepEqual(changed.original, fixture.initialPreview);
  assert.deepEqual(report.reviewedFixture, {...fixture, initialPreview: changed.reviewed});
  assert.notEqual(changed.reviewed.revision, changed.original.revision);
  const normalize = state => normalizeCancellationProfiles(state, fixture);
  const confirmed = json('records/cancellation-confirmed.json').state;
  for (const [index, phase] of staleCancellationPhonePhases.entries()) {
    const row = json('records/' + phase + '.json'); assert.equal(row.projectId, report.projectId); assert.equal(row.runId, report.runId);
    assert.equal(row.phase, phase); assert.deepEqual(row.result, report.checkpoints[index]);
    const observed = json('records/observed-' + phase + '-checkpoint.json'); assert.deepEqual(observed.state, row.state);
    if (index < 2) assert.deepEqual(normalize(row.state), normalize(initial));
    else if (index < 5) assert.deepEqual(normalize(row.state), normalize(peer));
    else {
      const result = verifyCancellationWithCapacity('cancellation-confirmed', peer, row.state, report.reviewedFixture, 1);
      assert.deepEqual(row.result, {...result, phase}); assert.deepEqual(normalize(row.state), normalize(confirmed));
    }
  }
  const sha = value => createHash('sha256').update(value).digest('hex');
  for (const phase of readdirSync(resolve(base, 'captures')).filter(file => file.endsWith('.json')).map(file => file.slice(0, -5))) {
    const capture = json('captures/' + phase + '.json'); assert.equal(capture.phase, phase);
    assert.equal(capture.source, 'session-window-not-native-device-export');
    assert.deepEqual(capture.crop, {left: 649, top: 107, width: 254, height: 564});
    const original = bytes('captures/' + capture.original), crop = bytes('captures/' + phase + '-phone.png');
    assert.equal(sha(original), capture.originalSha256); assert.equal(sha(crop), capture.cropSha256);
    const rawSize = imageSize(original), size = imageSize(crop);
    assert.equal(rawSize.width, capture.originalWidth); assert.equal(rawSize.height, capture.originalHeight);
    assert.equal(size.type, 'png'); assert.equal(size.width, 254); assert.equal(size.height, 564);
  }
  assert.deepEqual(summary.publicImages, staleCancellationPublicImages);
  assert(!summary.publicImages.includes('signed-out')); assert.equal(summary.firstSignOutCaptureAccepted, false);
  assert.equal(summary.finalSignOutCapture, 'signed-out-confirmed');
  assert.equal(summary.scope, 'physical-android-stale-cancellation-preview-with-isolated-peer-service-not-concurrent-two-phone-proof');
  assert.equal(summary.checkpoints, 8); assert.equal(summary.phoneUiReviewed, true); assert.equal(summary.recordResultsVerified, true);
  assert.equal(summary.sourceCommit, 'dcd7a5e68ce860488db046bc86ea5dc0cda05593');
  assert.equal(summary.sourceApkCommit, 'a1d0d96');
  assert.equal(summary.sourceApkSha256, '3837331ce85b2cddadc39145f6ae2713f504ac590114a7c97d89763a3adc6642');
  for (const key of ['concurrentTransactionOverlapProven', 'twoPhoneExchangeProven', 'peerPhoneUiProven',
    'phoneWireAbortedCodeProven', 'pushDeliveryProven', 'installedBytesIndependentlyVerified', 'independentPackageAbsenceProven',
    'realPayments', 'productionWrites', 'videoRecorded', 'iosUiExecuted', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(summary.providerRequests, 0);
  const checks = json('baseline-ci.json'); assert.equal(checks.headRefOid, summary.sourceCommit);
  assert(checks.statusCheckRollup.length > 0);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  const disposal = json('disposal.json');
  for (const key of ['fixtureSessionAbsent', 'runtimeDirectoryAbsent', 'helperDirectoryAbsent', 'ownedPortsClosed',
    'privateInputClosed', 'helperGroupStopped', 'runtimeGroupStopped', 'hostClipboardRestored', 'providerIdleObserved', 'uninstallAcknowledged'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.independentPackageAbsenceProven, false); assert.equal(disposal.temporaryDeviceAdministratorUsed, false);
  assert.equal(disposal.installationPolicyChanged, false);
  assert.match(bytes('captures/uninstall-observation.txt').toString(), /Succesfully uninstalled your app\(s\)!/);
  const idle = bytes('captures/session-stop-observation.txt').toString(); assert.match(idle, /Uploaded Apps/); assert(!idle.includes('appLiveStopSession'));
  return {checkpoints: 8, returnedSeats: 3, newCancellationReceipts: 1, cancellationNotices: 2,
    stalePreviewRejectedOnPhone: true, concurrentTransactionOverlapProven: false, releaseComplete: false};
}
