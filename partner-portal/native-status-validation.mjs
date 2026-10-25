import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';

export function validateNativeStatus(root, blockers) {
  const blocker = blockers.find(row => row.id === 'native-evidence-copy');
  const source = blocker?.source;
  assert.equal(source, 'docs/release/evidence/native-renderer-recheck-2026-10-25/README.md');
  assert.equal(blocker.checksums, dirname(source) + '/artifact-sha256.json');
  const base = resolve(root, dirname(source)); assertEvidenceBundleChecksums(base);
  const read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file));
  const report = json('summary.json'), run = json('matrix-run.json');
  assert.equal(report.scope, 'failed-renderer-recheck-and-independent-team-copy-failure-not-release-proof');
  for (const key of ['fullGatePassed', 'rendererRootCauseFixed', 'physicalDeviceAccepted', 'releaseScenariosAccepted'])
    assert.equal(report[key], false, key);
  assert.deepEqual(report.publicMedia, []);
  assert.equal(run.databaseId, report.matrixRunId); assert.equal(run.headSha, report.sourceCommit);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ')
    && !job.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length, 10); assert(focused.every(job => job.conclusion === 'success'));
  const parsed = parseAndroidJUnitTranscript(read('matrix/ordinary-instrumentation.txt'));
  const original = json('matrix/ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(original[key], value);
  assert.deepEqual(report.ordinary, {passed: parsed.passed, skipped: parsed.skipped, failed: parsed.failed});
  assert.equal(parsed.failed, 1); assert.match(read('matrix/ordinary-instrumentation.txt'), /Failed waiting for PixelCopy!/);
  const replay = json('matrix/results.json');
  assert.equal(replay.scope, 'local-ui-not-physical-device'); assert.equal(replay.steps.length, replay.testCount);
  assert.equal(replay.testCount, report.replay.groups); assert.equal(replay.nativeCaseCount, report.replay.cases);
  assert.equal(report.replay.passed, true); assert(replay.steps.every(step => step.status === 'passed'));
  assert.deepEqual(json('matrix/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 0});
  for (const phase of ['trip-change-parent-confirmation', 'trip-consent-recovery', 'notification-read-restart']) {
    const copy = json('matrix/adb-pull-' + phase + '.json');
    assert.equal(copy.runId, replay.runId); assert.equal(copy.phase, phase);
    assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null);
  }
  const team = json('team-job.json'), copy = json('team/primary-copy.json');
  assert.equal(team.id, report.focusedJobId); assert.equal(team.run_id, report.focusedRunId);
  assert.equal(team.status, 'completed'); assert.equal(team.conclusion, 'failure');
  assert.equal(report.focusedScreenAssertionsCompleted, true);
  assert.equal(report.focusedPrimaryCopyPassed, false);
  assert.match(read('team/instrumentation.txt'), /OK \(1 test\)/);
  assert.equal(copy.completed, false); assert.equal(copy.status, 1); assert.equal(copy.signal, null);
  const diagnostics = json('team/sync-diagnostics.json'); assert.equal(diagnostics.runId, copy.runId);
  assert(diagnostics.observations.filter(item => item.stderr?.includes('device offline')).length >= 3);
  assert(diagnostics.observations.some(item => item.value?.includes('connection terminated: write failed')));
  for (const file of ['matrix/device-restore.json', 'team/device-restore.json']) {
    const cleanup = json(file); assert.equal(cleanup.restored, true); assert.equal(cleanup.verified, true);
  }
  const host = json('matrix/host-observation.json');
  assert.equal(host.finalState, 'zombie'); assert.equal(host.targetExitObserved, false);
  const artifacts = json('artifact-inventory.json'); assert.equal(artifacts.length, 2);
  for (const artifact of artifacts) assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const later=json('later-run-terminal.json');
  assert.equal(later.databaseId,report.focusedRunId);assert.equal(later.headSha,team.head_sha);
  assert.equal(later.status,'completed');assert.equal(later.conclusion,'failure');
  assert.equal(later.jobs.find(job=>job.name==='Android native UI tests').conclusion,'success');
  assert.equal(later.jobs.find(job=>job.databaseId===team.id).conclusion,'failure');
  for(const attempt of [2,3]) {
    const path='manual/attempt-'+attempt+'/';
    assert.match(read(path+(attempt===2?'instrumentation.txt':'component-instrumentation.txt')),/shortMsg=Process crashed/);
    assert.equal(json(path+'process-exit.json').exited,true);
  }
  assert.equal(json('manual/attempt-2/restoration-failure.json').restored,false);
  assert.equal(json('manual/attempt-3/restoration.json').verified,true);
  assert.equal(json('manual/attempt-3/restoration.json').restoration.localPackagesRemoved,true);
  const disposal=json('manual/disposal.json');assert(Object.values(disposal.removed).every(Boolean));
  assert.equal(disposal.earlierRestorationFailureOverridden,false);assert.equal(disposal.screenAssertionsAccepted,false);
  return {...report,laterMainJobPassed:true};
}
