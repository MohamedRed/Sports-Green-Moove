import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {trackingNetworkPhases, verifyTrackingNetworkCheckpoint} from './tracking-network-checkpoints.mjs';

export function validateTrackingNetworkPhone(root, record) {
  const base = resolve(root, dirname(record.source));
  assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  assertEvidenceBundleChecksums(base);
  const json = name => JSON.parse(readFileSync(resolve(base, name)));
  const review = json('summary.json'), run = json('records/session-results.json'), initial = json('records/baseline.json');
  assert.equal(review.scope, 'physical-phone-simulated-network-loss-incomplete-display-recovery');
  assert.equal(review.testedAt.slice(0, 10), record.checkedAt);
  assert.equal(run.scope, 'independent-simulated-network-record-checkpoints-not-phone-ui-proof');
  assert.equal(run.completed, true); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(review.runId, run.runId); assert.equal(initial.runId, run.runId);
  assert(run.adminClientClosed && run.firestoreClientTerminated);
  assert.deepEqual(run.fixture, initial.fixture);
  assert.deepEqual(run.checkpoints.map(row => row.phase), trackingNetworkPhases);
  let previous;
  for (const [index, phase] of trackingNetworkPhases.entries()) {
    const stage = json('records/' + phase + '.json'); assert.equal(stage.runId, run.runId);
    const checked = verifyTrackingNetworkCheckpoint(phase, stage.state, initial.baseline, run.fixture, previous, stage.result.observedForMs);
    assert.deepEqual(stage.result, checked); assert.deepEqual(run.checkpoints[index], checked); previous = stage.state;
  }
  for (const key of ['uploadRecoveryObserved', 'staleWarningObserved', 'manualScreenRefreshObserved', 'signedOutUiObserved']) assert.equal(review[key], true);
  for (const key of ['continuousDisplayProven', 'automaticDisplayRecoveryProven', 'overallFlowAccepted', 'rootCauseConfirmed',
    'productionWrites', 'releaseScenariosAccepted', 'realNetworkLossProven', 'realMovementProven', 'childTrackingProven',
    'parentPhoneProven', 'mapsDisplayProven', 'videoRecorded']) assert.equal(review[key], false);
  assert.equal(review.routeProviderRequests, 0);
  const contradiction = json('display-stalled-backend-fresh.json');
  assert.equal(contradiction.status, 200); assert(contradiction.backendAgeMs >= 0 && contradiction.backendAgeMs < 30_000);
  assert.equal(contradiction.vehicle.lat, 50.7177); assert.equal(contradiction.vehicle.lng, 4.6177);
  const cleanup = json('cleanup.json');
  for (const key of ['phoneSessionStopped', 'networkSimulationRestored', 'helperGroupStopped', 'helperHandoffRemoved',
    'runtimeRemoved', 'privateSessionRemoved', 'endpointsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.packageAbsenceProven, false);
  const captures = json('captures.json');
  assert.deepEqual(captures.public, ['offline-stale', 'manual-screen-return', 'after-manual-return-observation']);
  for (const [name, item] of Object.entries(captures.files)) {
    assert.equal(item.width, 253); assert.equal(item.height, 564); assert.equal(item.source, 'unscaled-browser-device-viewport');
    if (captures.public.includes(name)) assert.equal(item.visuallyReviewed, true);
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'photos', name + '.jpg'))).digest('hex'), item.sha256);
  }
  for (const [file, hash] of Object.entries(run.sourceFiles)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, 'source', hash + '.txt'))).digest('hex'), hash, file);
  }
  return review;
}
