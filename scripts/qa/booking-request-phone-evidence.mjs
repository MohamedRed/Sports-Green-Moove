import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { bookingRequestPhonePhases, verifyBookingRequestPhoneState } from './booking-request-phone-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateBookingRequestPhoneEvidence(root, source) {
  const base = dirname(resolve(root, source));
  const bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  const run = json('results.json'), session = json('checkpoints/session-results.json');
  assert.equal(run.scope, 'physical-android-request-notice-with-isolated-services-and-device-replacement');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(session.projectId, run.projectId);
  assert.match(run.runId, /^[a-f0-9]{32}$/); assert.equal(run.runId, session.runId);
  assert.equal(run.testedAt, session.testedAt); assert.equal(run.testedAt.slice(0, 10), '2026-10-23');
  assert.equal(run.backendSourceCommit, '4d414f9f0a81a7b795077fb1e2cd41ef2f6a347b');
  assert.equal(run.selectedApk, 'sgm-notification-read-localhost-87082b10-20261023.apk');
  assert.equal(run.appSourceCommit, '87082b10');
  for (const key of ['manualNativeUiObserved', 'parentRequestInUi', 'driverNoticeInUi', 'driverReadInUi',
    'accountReturnOnSecondDevice', 'firstSessionInterrupted']) assert.equal(run[key], true, key);
  for (const key of ['installedBytesIndependentlyVerified', 'firstSessionInterruptionCauseKnown', 'sameDeviceEndToEnd',
    'simultaneousDevices', 'wholeProcessRestartProven', 'responseLossOrRetryInUiProven', 'parentSearchUiProven',
    'childBookingUiProven', 'pushDeliveryProven', 'physicalTrackingProven', 'paymentExercised',
    'productionWrites', 'videoCaptured', 'releaseComplete']) assert.equal(run[key], false, key);
  assert.deepEqual(run.deviceSequence, ['Google Pixel 9 Pro / Android 15', 'Google Pixel 9 / Android 15']);
  assert.deepEqual(run.accountsInOrder, ['sgm-qa-parent', 'sgm-qa-driver', 'sgm-qa-parent', 'sgm-qa-driver']);
  assert.deepEqual(run.profileTimestampExceptions, ['sgm-qa-parent', 'sgm-qa-driver']);
  assert.equal(run.independentCheckpoints, 6); assert.equal(run.protectedRecordCount, 159);
  assert.equal(session.completed, true); assert.equal(session.adminClientClosed, true);
  assert.equal(session.scope, 'independent-booking-request-notice-checkpoints-not-phone-ui-proof');
  assert.equal(session.protectedRecordCount, 159); assert.equal(session.checkpoints.length, 6);
  for (const key of ['physicalUiProven', 'wholeProcessRestartProven', 'pushDeliveryProven', 'productionWrites'])
    assert.equal(session[key], false, key);
  let baseline, requested, read, previousAt = 0;
  for (const [index, phase] of bookingRequestPhonePhases.entries()) {
    const checkpoint = json('checkpoints/' + phase + '.json');
    assert.equal(checkpoint.runId, run.runId); assert.equal(checkpoint.projectId, run.projectId);
    assert.deepEqual(checkpoint.fixture, session.fixture);
    if (!index) baseline = checkpoint.baseline;
    assert.deepEqual(checkpoint.baseline, baseline);
    assert(Date.parse(checkpoint.recordedAt) > previousAt); previousAt = Date.parse(checkpoint.recordedAt);
    assert(previousAt <= Date.parse(run.testedAt));
    const result = verifyBookingRequestPhoneState(phase, checkpoint.state, baseline, checkpoint.fixture);
    assert.deepEqual(checkpoint.result, result); assert.deepEqual(session.checkpoints[index], result);
    if (phase === 'parent-requested') requested = checkpoint.state.records;
    if (phase === 'driver-unread') assert.deepEqual(checkpoint.state.records, requested);
    if (phase === 'driver-read') read = checkpoint.state.records;
    if (['parent-returned', 'driver-returned'].includes(phase)) assert.deepEqual(checkpoint.state.records, read);
  }
  assert.deepEqual(Object.keys(session.sourceFiles).sort(), ['scripts/qa/manual-booking-request-phone-session.mjs',
    'scripts/qa/booking-request-phone-checkpoints.mjs', 'functions/src/callables/bookingRequests.ts',
    'functions/src/lib/bookingNotifications.ts', 'functions/src/callables/notificationRead.ts'].sort());
  for (const [file, digest] of Object.entries(session.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), digest, file);
  const cleanup = json('cleanup.json');
  for (const key of ['adminClientClosed', 'firstHelperDirectoryRemoved', 'helperDirectoryRemoved', 'backendDirectoryRemoved',
    'privateSessionRemoved', 'ephemeralCredentialsCleared', 'firstPhoneSessionEnded', 'secondPhoneSignedOutObserved',
    'secondPhoneSessionStopped', 'uninstallAttempted']) assert.equal(cleanup[key], true, key);
  for (const key of ['firstHelperUnexpectedExitCauseKnown', 'phoneAppUninstallIndependentlyVerified',
    'providerDeviceResetIndependentlyVerified', 'clipboardRestorationVerified', 'devicePolicyChanged', 'locationPermissionChanged'])
    assert.equal(cleanup[key], false, key);
  assert.equal(cleanup.backendExit, 130); assert.equal(cleanup.helperExit, 130); assert.equal(cleanup.firstHelperExit, 0);
  assert.equal(cleanup.providerUninstallResponse, 'No user apps found to uninstall.');
  assert.deepEqual(cleanup.endpoints, { host: '127.0.0.1', ports: [5001, 8080, 9000, 9099], closed: true });
  const times = json('capture-times.json');
  const phases = ['parent-request-sent', 'driver-unread', 'driver-read', 'parent-returned', 'driver-returned'];
  assert.deepEqual(Object.keys(run.publishedCaptures), phases.map(phase => 'booking-request-phone-' + phase));
  let capturedAt = 0;
  for (const phase of [...phases, 'signed-out']) {
    assert(Date.parse(times[phase].capturedAt) > capturedAt); capturedAt = Date.parse(times[phase].capturedAt);
    assert.equal(times[phase].device, run.deviceSequence[phase === 'parent-request-sent' ? 0 : 1]);
    if (phase !== 'signed-out') assert.equal(run.publishedCaptures['booking-request-phone-' + phase], 'captures/' + phase + '.jpg');
    const size = imageSize(bytes('captures/' + phase + '.jpg'));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, phase === 'parent-request-sent' ? 240 : 239);
    assert.equal(size.height, phase === 'parent-request-sent' ? 510 : 507);
  }
  assertEvidenceBundleChecksums(base);
  return run;
}
