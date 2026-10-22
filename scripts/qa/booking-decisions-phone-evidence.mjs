import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { bookingPhonePhases, verifyBookingPhoneCheckpoint } from './manual-booking-phone-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateBookingDecisionsPhone(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), run = json('results.json'), session = json('session-results.json');
  assert.equal(run.scope, 'physical-android-booking-decisions-with-isolated-services');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, session.runId);
  assert.equal(run.appSourceCommit, '458318c3d7e64252d39c9458dd94cf04a06df79a');
  assert.equal(run.appSha256, '41bef01f1ce2073ccf16ff82acab6af1b94e35f96e8381668ad23ba4c5e8be44');
  assert.equal(run.testedAt, session.testedAt); assert.equal(run.testedAt.slice(0, 10), '2026-10-22');
  for (const key of ['completed', 'physicalDevice', 'manualNativeUiObserved', 'driverDecisionsInUi',
    'parentCancellationInUi', 'recipientInboxesInUi', 'requestsPreparedThroughAuthenticatedServices', 'controllerSourcesArchived'])
    assert.equal(run[key], true, key);
  for (const key of ['parentSearchOrRequestUiVerified', 'twoPhoneFlowVerified', 'pushDeliveryVerified', 'paymentExercised',
    'physicalTrackingVerified', 'productionWrites', 'releaseComplete', 'videoCaptured', 'nativePngExportObtained'])
    assert.equal(run[key], false, key);
  assert.deepEqual(run.accountsInOrder, ['sgm-qa-driver', 'sgm-qa-parent', 'sgm-qa-driver']);
  assert.equal(run.independentCheckpoints, 6); assert.equal(session.completed, true); assert.equal(session.adminClientClosed, true);
  assert.equal(session.fixtureEnvironmentDestroyed, false, 'Independent disposal stays in its separate receipt');
  assert.equal(session.checkpoints.length, bookingPhonePhases.length); assert.equal(session.protectedRecordCount, 158);
  let previousAt = 0;
  for (const [index, phase] of bookingPhonePhases.entries()) {
    const checkpoint = json(phase + '.json'); assert.equal(checkpoint.runId, run.runId);
    assert.equal(checkpoint.originalClaimsUnchanged, true); assert.equal(checkpoint.protectedRecordCount, 158);
    assert(Date.parse(checkpoint.recordedAt) > previousAt); previousAt = Date.parse(checkpoint.recordedAt);
    assert.deepEqual(checkpoint.result, verifyBookingPhoneCheckpoint(phase, checkpoint.state, checkpoint.fixture));
    assert.deepEqual(session.checkpoints[index], checkpoint.result);
  }
  for (const [file, digest] of Object.entries(session.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), digest, file);
  const cleanup = json('cleanup.json');
  for (const key of ['adminClientClosed', 'phoneAppUninstallConfirmedByProvider', 'phoneSessionStopped', 'backendDirectoryRemoved',
    'privateSessionRemoved', 'helperDirectoryRemoved', 'firstAttemptBackendDirectoryRemoved', 'firstAttemptPrivateSessionRemoved',
    'firstAttemptPhoneStopped', 'fixtureEnvironmentDestroyed', 'credentialDiscarded', 'hostClipboardRestored']) assert.equal(cleanup[key], true, key);
  for (const key of ['independentPackageInventoryRead', 'devicePolicyChanged', 'locationPermissionGranted']) assert.equal(cleanup[key], false);
  assert.equal(cleanup.backendExit, 130); assert.equal(cleanup.helperExit, 130);
  assert.deepEqual(cleanup.endpoints, {host: '127.0.0.1', ports: [5001,8080,9000,9099,45690,45691], closed: true});
  const first = json('first-attempt/session-results.json'), queue = json('first-attempt/queue-observation.json');
  assert.equal(first.completed, false); assert.equal(first.checkpoints.length, 1); assert.notEqual(first.runId, run.runId);
  for (const [file, digest] of Object.entries(first.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('first-attempt/source/' + file)).digest('hex'), digest, file);
  for (const key of ['approvedBookingReturned', 'incorrectUnfilteredPendingIncludesApproved', 'correctedPendingExcludesApproved'])
    assert.equal(queue[key], true); assert.equal(queue.runId, first.runId);
  const startup = json('startup-diagnostic.json'); assert.equal(startup.code, 126); assert.equal(startup.diagnostics.portUnavailable, true);
  assert.match(startup.startupOutput, /SYS_CONFLICT:1001/); assert.equal(startup.requestLoggingEnabled, false);
  assert.equal(startup.rawLogWrittenToDisk, false); assert.equal(startup.normalVerbosity, 0);
  assert.equal(startup.previousConnectionStoppedWithUserApproval, true);
  const times = json('capture-times.json'); assert.equal(Object.keys(run.publishedCaptures).length, 8);
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    const phase = id.replace('booking-decision-phone-', ''); assert.equal(file, phase + '-device.jpg');
    assert(Date.parse(times[phase]) <= Date.parse(run.testedAt));
    const image = imageSize(bytes(file)); assert.equal(image.type, 'jpg'); assert.equal(image.width, 278); assert.equal(image.height, 620);
    const context = imageSize(bytes(phase + '-context.jpg')); assert.equal(context.width, 1440); assert.equal(context.height, 778);
  }
  assertEvidenceBundleChecksums(base);
  return run;
}
