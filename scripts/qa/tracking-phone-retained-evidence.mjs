import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {verifyTrackingPhoneCheckpoint} from './tracking-phone-checkpoints.mjs';

export function validateTrackingPhoneAttempt(root, source) {
  const base = resolve(root, 'docs/release/evidence/tracking-phone-clock-2026-10-25');
  assert.equal(source, 'docs/release/evidence/tracking-phone-clock-2026-10-25/session-results.json');
  assertEvidenceBundleChecksums(base);
  const json = name => JSON.parse(readFileSync(resolve(base, name)));
  const run = json('session-results.json'), {baseline, fixture} = json('baseline.json');
  assert.equal(run.completed, false); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.adminClientClosed, true); assert.equal(run.firestoreClientTerminated, true);
  assert.equal(run.phoneUiProven, false); assert.equal(run.realMovementProven, false);
  assert.equal(run.childTrackingProven, false); assert.equal(run.productionWrites, false); assert.equal(run.routeProviderRequests, 0);
  assert.deepEqual(run.checkpoints.map(row => row.phase), ['prepared', 'foreground-first']);
  assert.deepEqual(run.fixture, fixture);
  assert.deepEqual(run.sourceFiles, {
    'scripts/qa/manual-tracking-phone-session.mjs': 'd54c54f842f1afe88eea6a6474ad2d84b76d1c766dd675c51a28499372b335f0',
    'scripts/qa/tracking-phone-checkpoints.mjs': '95bf48d2b0c68c03b83e9f5c86ab1bfb6aca5398f38ef572d3d14773a4735d78',
    'scripts/qa/session-restoration-records.mjs': 'd69bb76e99838f0f3c59e2beda3a9fe14a311951085a997577f05f08fa6a1802',
  }, 'This historical attempt must keep its original controller version');
  for (const [index, phase] of ['prepared', 'foreground-first'].entries()) {
    const stage = json(phase + '.json'); assert.equal(stage.runId, run.runId);
    assert.deepEqual(verifyTrackingPhoneCheckpoint(phase, stage.state, baseline, fixture), run.checkpoints[index]);
  }
  for (const [file, sha] of Object.entries(run.sourceFiles)) {
    const retained = readFileSync(resolve(base, 'source', file.split('/').at(-1) + '.txt'));
    assert.equal(createHash('sha256').update(retained).digest('hex'), sha);
  }
  const first = json('foreground-first.json'), final = json('final-stalled-state.json');
  const rideId = first.result.rideId, comparable = structuredClone(final.state);
  assert.equal(final.state.liveTrips[rideId].vehicle.lat, 50.7167);
  assert.equal(final.state.liveTrips[rideId].vehicle.lng, 4.6167);
  assert(final.state.liveTrips[rideId].vehicle.capturedAt >= first.state.liveTrips[rideId].vehicle.capturedAt);
  comparable.liveTrips[rideId].vehicle = first.state.liveTrips[rideId].vehicle;
  assert.deepEqual(comparable, first.state);
  assert.equal(final.parentRead.ride.rideSessionId, rideId); assert.equal(final.parentRead.ride.stale, true);
  assert(final.parentRead.ride.observation.vehicleAgeMs >= 90_000);
  const observed = json('foreground-move-observation.json'); assert.equal(observed.matched, false);
  assert.equal(observed.timeline.length, 45);
  assert(observed.timeline.at(-1).observedAt - observed.timeline[0].observedAt >= 88_000);
  assert(observed.timeline.every(row => row.point.lat === 50.7167 && row.point.lng === 4.6167));
  assert(json('latest-location-extract.json').mockLocations.every(line => line.includes('50.717700,4.617700')));
  const clock = json('clock-diagnostic.json').records; assert.equal(clock.length, 48);
  assert.equal(clock.filter(row => row.captureValid).length, 1);
  for (const row of clock) {
    assert.deepEqual(Object.keys(row).sort(), ['captureValid', 'capturedAt', 'futureDeltaMs', 'serverNow']);
    assert(Number.isSafeInteger(row.capturedAt) && row.capturedAt > 0 && Number.isSafeInteger(row.serverNow));
    assert.equal(row.futureDeltaMs, row.capturedAt - row.serverNow);
    assert.equal(row.captureValid, row.capturedAt <= row.serverNow);
  }
  assert(json('phone-clock-bounded-extract.json').minimumPhoneAheadMs >= 533);
  assert.match(readFileSync(resolve(base, 'source/liveTrips-diagnostic-only.js.txt'), 'utf8'), /SGM_QA_CLOCK_ONLY/);
  assert.doesNotMatch(readFileSync(resolve(base, 'source/liveTrips-before-diagnostic.js.txt'), 'utf8'), /SGM_QA_CLOCK_ONLY/);
  assert.match(readFileSync(resolve(base, 'phone-cleanup.txt'), 'utf8'), /Unable to find package: be\.sportgreenmoove\.app\.local/);
  return run;
}
