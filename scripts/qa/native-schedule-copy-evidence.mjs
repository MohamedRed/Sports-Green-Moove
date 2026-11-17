import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeScheduleCopy(root,record) {
  const base=dirname(resolve(root,record.source)),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  const summary=json('summary.json'),run=json('native-run.json');
  assert.equal(record.checkedAt,summary.checkedAt); assert.equal(record.checkedAt,'2026-10-23');
  assert.equal(resolve(root,record.checksums),resolve(base,'artifact-sha256.json'));
  assert.equal(summary.scope,'terminal-schedule-primary-copy-offline-observation-not-root-cause-or-full-replay');
  assert.equal(run.databaseId,40027788818); assert.equal(run.headSha,'3413b579ac5c8cb3c5a4a7f172b74aa5ad339d4a');
  assert.equal(summary.sourceCommit,run.headSha); assert.equal(run.status,'completed'); assert.equal(run.conclusion,'failure');
  assert.equal(run.jobs.find(job=>job.databaseId===120668214455).conclusion,'failure');
  const focused=run.jobs.filter(job=>job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length,11); assert(focused.every(job=>job.conclusion==='success'));
  const artifact=json('artifact-metadata.json'); assert.equal(artifact.id,12534551829); assert.equal(artifact.workflow_run.head_sha,run.headSha);
  const ordinary=json('ordinary-results.json'); assert.equal(ordinary.passed,159); assert.equal(ordinary.skipped,52); assert.equal(ordinary.failed,0);
  assertInstrumentationPassed(read('schedule-instrumentation.txt'),1);
  const primary=json('primary-copy.json'),cleanup=json('cleanup-copy.json');
  assert.equal(primary.runId,'3b42b1824b7184809ce48528d7ee7a17'); assert.equal(primary.phase,'trip-change-schedule');
  assert.equal(primary.completed,false); assert.equal(primary.status,1);
  assert.equal(cleanup.runId,primary.runId); assert.equal(cleanup.completed,true); assert.equal(cleanup.status,0);
  assert.match(cleanup.stderr,/102 files pulled, 0 skipped/);
  const diagnostics=json('sync-diagnostics.json'); assert.equal(diagnostics.runId,primary.runId);
  for(const id of ['directory-stat','shell-listing','sync-listing']) {
    const observation=diagnostics.observations.find(row=>row.id===id);
    assert.equal(observation.collected,false); assert.match(observation.stderr,/device offline/);
  }
  const storage=diagnostics.observations.find(row=>row.id==='storage-service-log'); assert.equal(storage.collected,true);
  assert.match(storage.value,/host-18: connection terminated: write failed/); assert.match(storage.value,/host-19:.*thread spawning/);
  assert.equal(json('device-restoration.json').verified,true); assert.equal(json('host-observation.json').finalState,'gone');
  for(const key of ['authorizationRemoved','componentRemoved','originalPolicyRestored'])
    assert.equal(json('device-restoration.json').restoration.installAdmin[key],true);
  for(const [key,value] of Object.entries({ordinaryPassed:159,ordinarySkipped:52,ordinaryFailed:0,focusedJobsPassed:10,cleanupFilesPulled:102}))
    assert.equal(summary[key],value);
  for(const key of ['deviceRestorationVerified','hostExitVerified','deviceOfflineObserved']) assert.equal(summary[key],true);
  for(const key of ['fullReplayAccepted','primaryCopyAccepted','rootCauseConfirmed','earlierStartupCauseConfirmed',
    'physicalTrackingAccepted','newMediaPublished','productionWrites','releaseComplete']) assert.equal(summary[key],false);
  assertEvidenceBundleChecksums(base); return summary;
}
