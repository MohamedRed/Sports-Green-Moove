import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const flowGate398Folder = 'docs/release/evidence/flow-gate-398d207-2026-10-26/';
export function validateFlowGate398(root) {
  const folder = resolve(root, flowGate398Folder); assertEvidenceBundleChecksums(folder);
  const read = file => JSON.parse(readFileSync(resolve(folder, file)));
  const head = '398d207b52b925b9c6d1dae49419e6a848d05161', checks = read('pr-checks.json'), run = read('native-run.json');
  assert.equal(checks.headRefOid, head); assert.equal(run.headSha, head); assert.equal(run.databaseId, 40406032732);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.equal(checks.statusCheckRollup.length, 25);
  assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === 'SKIPPED').length, 5);
  assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === 'SUCCESS').length, 20);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'success');
  assert.deepEqual(read('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const ordinary = read('ordinary-results.json'), replay = read('local-replay-results.json');
  assert.equal(ordinary.complete, true); assert.equal(ordinary.guardConfirmed, true);
  assert.equal(ordinary.caseCount, 231); assert.equal(ordinary.cases.length, 231);
  for (const [status, count] of [['passed', 177], ['skipped', 54], ['failed', 0]]) {
    assert.equal(ordinary[status], count); assert.equal(ordinary.cases.filter(row => row.status === status).length, count);
  }
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.testCount, 37);
  assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37); assert(replay.steps.every(row => row.status === 'passed'));
  const copy = read('original-primary-copy.json'); assert.equal(copy.runId, replay.runId);
  assert.equal(copy.phase, 'trip-consent-recovery'); assert.equal(copy.status, 0); assert.equal(copy.completed, true);
  assert.deepEqual(copy.hostBefore.daemonEvents, copy.hostAfter.daemonEvents);
  const events = copy.hostBefore.daemonEvents;
  assert.equal(events.available, true); assert.equal(events.rawLogsRetained, false); assert.equal(events.sourceTailLimitBytes, 65536);
  assert.equal(events.scope, 'allowlisted-adb-daemon-transport-events-not-disconnect-cause');
  assert.deepEqual(events.selectedPids, [3546]); assert.equal(events.matchedEventCount, 1); assert.equal(events.droppedEventCount, 0);
  assert.deepEqual(events.events, [{ timestampLocal: '10-26 21:44:29.207', pid: 3546, tid: 3554, source: 'transport.cpp',
    emulatorPort: 5554, kind: 'connection-terminated-read-failed', errno: null }]);
}
