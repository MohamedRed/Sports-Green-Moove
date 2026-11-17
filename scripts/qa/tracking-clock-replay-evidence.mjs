import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {trackingPhonePhases, verifyTrackingPhoneCheckpoint} from './tracking-phone-checkpoints.mjs';

export function validateTrackingClockReplay(root, record) {
  const base = resolve(root, dirname(record.source));
  assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  assertEvidenceBundleChecksums(base);
  const json = file => JSON.parse(readFileSync(resolve(base, file)));
  const review = json('summary.json'), prior = json('records/session-results.json');
  const baseline = json('records/baseline.json');
  assert.equal(review.scope, 'physical-phone-simulated-driver-gps-not-outdoor-release-proof');
  assert.equal(review.testedAt.slice(0, 10), record.checkedAt);
  assert.equal(review.runId, prior.runId); assert.equal(baseline.runId, prior.runId);
  assert.equal(prior.completed, false, 'The prematurely requested final checkpoint remains incomplete');
  assert.equal(prior.adminClientClosed, true); assert.equal(prior.firestoreClientTerminated, true);
  assert.deepEqual(prior.checkpoints.map(row => row.phase), trackingPhonePhases.slice(0, -1));
  let previous;
  for (const phase of trackingPhonePhases.slice(0, -1)) {
    const checkpoint = json('records/' + phase + '.json');
    assert.equal(checkpoint.runId, prior.runId);
    assert.deepEqual(checkpoint.result,
      verifyTrackingPhoneCheckpoint(phase, checkpoint.state, baseline.baseline, prior.fixture, previous));
    previous = checkpoint.state;
  }
  const final = json('records/supplemental-signed-out-stable.json');
  assert.equal(final.scope, 'supplemental-read-only-sign-out-stability-not-original-run-completion');
  assert.equal(final.runId, prior.runId); assert.equal(final.passed, true);
  assert.equal(final.originalObserverCompleted, false); assert(final.observedForMs >= 50_000);
  assert(final.adminClientClosed && final.firestoreClientTerminated);
  assert.deepEqual(final.result,
    verifyTrackingPhoneCheckpoint('signed-out-stable', final.state, baseline.baseline, prior.fixture, previous));
  for (const phase of ['foreground-first', 'foreground-moved', 'background-moved', 'foreground-returned']) {
    const point = json('records/' + phase + '.json').result.vehicle;
    assert.equal(point.captureClock, 'serverElapsedRealtime'); assert(Number.isSafeInteger(point.deviceCapturedAt));
    assert(point.capturedAt <= point.uploadedAt);
  }
  assert.equal(review.originalObserverCompleted, false); assert.equal(review.supplementalSignOutPassed, true);
  for (const key of ['foregroundMovementObserved', 'backgroundMovementObserved', 'signedOutUiObserved']) assert.equal(review[key], true);
  for (const key of ['outdoorMovementProven', 'childTrackingProven', 'parentPhoneProven', 'mapsDisplayProven',
    'lockedScreenProven', 'networkLossProven', 'gpsLossProven', 'restartProven', 'batterySaverProven',
    'productionWrites', 'productionDeployed', 'releaseScenariosAccepted', 'videoRecorded']) assert.equal(review[key], false);
  assert.equal(review.routeProviderRequests, 0);
  assert.equal(review.connectedLocalCasePassed, false);
  const apk = json('apk-provenance.json');
  assert.equal(apk.applicationId, 'be.sportgreenmoove.app.local'); assert.equal(apk.emulatorHost, '127.0.0.1');
  assert.match(apk.apkSha256, /^[a-f0-9]{64}$/); assert.equal(apk.realMapsEnabled, false);
  const cleanup = json('cleanup.json');
  for (const key of ['phoneSessionStopped', 'helperGroupStopped', 'helperHandoffRemoved', 'runtimeRemoved',
    'privateSessionRemoved', 'endpointsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.packageAbsenceProven, false);
  const captures = json('captures.json');
  assert.deepEqual(captures.public, ['foreground-first', 'foreground-returned', 'signed-out-stable']);
  for (const [name, item] of Object.entries(captures.files)) {
    assert.equal(item.width, 253); assert.equal(item.height, 564); assert.equal(item.format, 'jpeg');
    assert.equal(item.source, 'unscaled-browser-device-viewport'); assert.equal(item.visuallyReviewed, true);
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'photos/' + name + '.jpg'))).digest('hex'), item.sha256);
  }
  for (const [file, hash] of Object.entries(review.sourceFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'source', hash + '.txt'))).digest('hex'), hash, file);
  }
  for (let index = 1; index <= 4; index++) {
    assert.equal(json('local-attempts/' + index + '/failed-source.json').completed, false);
    const disposal = json('local-attempts/' + index + '/device-disposal.json');
    assert(disposal.avdAbsent && disposal.restorationVerified && disposal.endpoints.closed);
  }
  return review;
}
