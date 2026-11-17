import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const contextReplayHead = '22640188e3e528edadc7feb34027b2d187543cad';
export function assertContextReplayGate(base) {
  const json = file => JSON.parse(readFileSync(resolve(base, file))), text = file => readFileSync(resolve(base, file), 'utf8');
  const run = json('native-run.json'), pr = json('pr-checks.json'), artifact = json('native-artifact.json');
  assert.equal(run.databaseId, 40960693917); assert.equal(run.headSha, contextReplayHead);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success'); assert.equal(run.jobs.length, 20);
  assert(run.jobs.every(row => row.status === 'completed' && ['success', 'skipped'].includes(row.conclusion)));
  assert.equal(run.jobs.filter(row => row.name.includes(' / Isolated ') && !row.name.endsWith('safety flows')).length, 11);
  assert.deepEqual(run.jobs.filter(row => row.conclusion === 'skipped').map(row => row.name).sort(),
    ['Android approved real-map UI integration', 'Android approved vehicle-map UI', 'Android approved parent search and booking',
      'iOS native checks', 'iOS native UI tests'].sort());
  assert.equal(pr.headRefOid, contextReplayHead); assert.equal(pr.statusCheckRollup.length, 29);
  assert(pr.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  assert.equal(artifact.id, 12936539707); assert.equal(artifact.workflow_run.id, run.databaseId);
  assert.equal(artifact.workflow_run.head_sha, contextReplayHead);
  const parsed = parseAndroidJUnitTranscript(text('native/ordinary-instrumentation.txt')), stored = json('native/ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(stored[key], value);
  assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [250, 196, 54, 0]);
  const contextCases = parsed.cases.filter(row => row.className.endsWith('.ReviewTripContextFlowTest'));
  assert.equal(contextCases.length, 3); assert(contextCases.every(row => row.status === 'passed'));
  const replay = json('native/replay/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.runId, '44bd901005f2cc96dd28972318cd963b');
  assert.deepEqual([replay.testCount, replay.nativeCaseCount, replay.steps.length], [37, 40, 37]);
  assert(replay.steps.every(row => row.status === 'passed')); assert(replay.adminClientClosed && replay.firestoreClientTerminated);
  const files = readdirSync(resolve(base, 'native/replay')), transcripts = files.filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32); let cases = 0;
  for (const file of transcripts) {const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(text('native/replay/' + file), count); cases += count;}
  assert.equal(cases, 40);
  const copies = files.filter(file => file.startsWith('adb-pull-')); assert.equal(copies.length, 17);
  for (const file of copies) {const row = json('native/replay/' + file); assert.equal(row.runId, replay.runId);
    assert.equal(row.completed, true); assert.equal(row.status, 0); assert.notEqual(row.phase, 'failure-cleanup');
    assert.equal(file, 'adb-pull-' + row.phase + '.json');}
  assert.deepEqual(json('native/native-suite-status.json'),
    {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const restore = json('native/device-restoration.json'); assert.equal(restore.case, 'full-matrix');
  assert.equal(restore.restored, true); assert.equal(restore.verified, true); assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  return {ordinaryPassed: 196, ordinarySkipped: 54, replayCases: 40, primaryCopies: 17, contextualComponentCases: 3};
}
