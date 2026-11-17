import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {focusedCases} from './android-case-apks.mjs';
import {summarizeGuestAdbdEvents} from '../diagnostics/adb-transfer-guest.mjs';

export const copyReconnectFolder='docs/release/evidence/copy-reconnect-ecd9b67-2026-10-31/';
export function assertCopyReconnectReview(review) {
  assert.equal(review.scope,'failed-primary-copy-and-reconnection-with-passing-capacity-not-complete-native-gate');
  assert.equal(review.sourceCommit,'ecd9b67058378f28e9be27a64fa771e2e13bdb7b');
  assert.equal(review.workflowRunId,41247850105); assert.equal(review.jobId,124674908197);
  assert.equal(review.runId,'a90b8084037a09bc2efa3cf028f8075f');
  assert.equal(review.ordinaryPassed,222); assert.equal(review.ordinarySkipped,54); assert.equal(review.ordinaryFailed,0);
  assert.equal(review.focusedJobsPassed,11);
  for(const key of ['hostCapacityReady','focusedCapacityStepExecuted','primaryCopyFailed','cleanupCopyPassed',
    'storedGuestPidObservedBeforeAndAfterReconnect','hostServerBirthUnchangedInSamples','guestConnectionChangedInLog']) assert.equal(review[key],true,key);
  for(const key of ['unusedToolRemovalExercised','previousCapacityFailureBlocksThisRun','guestBirthObserved',
    'guestBootIdentityObserved','rootCauseConfirmed','primaryFailureReplacedByCleanup','fullNativeGateAccepted',
    'productCodeChanged','physicalDeviceAccepted','productionWrites','releaseAccepted']) assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedMedia,[]);
}
export function validateCopyReconnect(root) {
  const folder=resolve(root,copyReconnectFolder), bytes=file=>readFileSync(resolve(folder,file));
  const json=file=>JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review=json('review.json'); assertCopyReconnectReview(review);
  const run=json('run.json'), job=json('job.json'), jobs=json('jobs.json').jobs;
  for(const row of [run,job]) {assert.equal(row.head_sha,review.sourceCommit);assert.equal(row.status,'completed');assert.equal(row.conclusion,'failure');}
  assert.equal(run.id,review.workflowRunId);assert.equal(job.id,review.jobId);assert.equal(job.run_id,run.id);
  for(const name of focusedCases) {
    const selected=jobs.filter(row=>row.name==='Android focused safety UI tests / Isolated '+name);
    assert.equal(selected.length,1);const row=selected[0];assert.equal(row.head_sha,review.sourceCommit);
    assert.equal(row.run_id,run.id);assert.equal(row.conclusion,'success');assert.equal(row.status,'completed');
    for(const name of ['Reserve disk space for the unchanged focused Android device','Run one isolated safety flow on its own phone'])
      assert.equal(row.steps.find(step=>step.name===name).conclusion,'success');
  }
  const artifact=json('artifact.json'), focus=json('focused-artifact.json'), archive=json('archive-verification.json');
  for(const [row,id,digest] of [[artifact,13060217427,'52012fbb6e48c8c8ff63b46fa9ee26c79eba143b299e24114140ed71a5d10a20'],
    [focus,13059798298,'4f7ab5c999ddf2c01a0339ff23e2c2a6b4e1dca97f393bb579db2f4101845585']]) {
    assert.equal(row.id,id);assert.equal(row.workflow_run.id,run.id);assert.equal(row.workflow_run.head_sha,review.sourceCommit);
    assert.equal(row.digest,'sha256:'+digest);
  }
  assert.equal(archive.mainDigestVerified,true);assert.equal(archive.focusedDigestVerified,true);assert.equal(archive.originalArchivesPublished,false);
  assert.equal(archive.mainDigest,artifact.digest);assert.equal(archive.focusedDigest,focus.digest);
  assert.equal(archive.mainBytes,artifact.size_in_bytes);assert.equal(archive.focusedBytes,focus.size_in_bytes);
  const sha=value=>createHash('sha256').update(value).digest('hex');assert.equal(Object.keys(archive.selectedMembers).length,7);
  const local=['adb-pull-trip-change-parent-confirmation.json','adb-sync-trip-change-parent-confirmation-diagnostics.json','adb-pull-failure-cleanup.json'];
  const stored=['ordinary-results.json','native-suite-status.json','disposable-store-restore.json'];
  assert.deepEqual(Object.keys(archive.selectedMembers).sort(),[...local,...stored,'host-disk-capacity.json'].sort());
  for(const [file,row] of Object.entries(archive.selectedMembers)) {
    const prefix=local.includes(file) ? 'outputs/local-ui-evidence/'+review.runId+'/' : stored.includes(file) ? 'outputs/store-review-screenshots/' : 'outputs/';
    assert.equal(row.member,prefix+file);assert.equal(sha(bytes(file)),row.sha256);
  }
  assert.equal(archive.focusedMember.member,'host-disk-capacity.json');
  assert.equal(sha(bytes('focused-host-disk-capacity.json')),archive.focusedMember.sha256);
  for(const file of ['host-disk-capacity.json','focused-host-disk-capacity.json']) {
    const disk=json(file);assert.equal(disk.scope,'hosted-runner-capacity-not-device-or-test-proof');assert.equal(disk.ready,true);
    assert.equal(disk.requiredBytes,11811160064);assert(disk.afterBytes>=disk.requiredBytes);
    assert.equal(disk.removedUnusedDotnet,false);assert.equal(disk.deviceStorageReduced,false);assert.equal(disk.testScopeReduced,false);
  }
  const ordinary=json('ordinary-results.json');assert.equal(ordinary.passed,222);assert.equal(ordinary.skipped,54);
  assert.equal(ordinary.failed,0);assert.equal(ordinary.caseCount,276);assert.equal(ordinary.complete,true);
  assert.deepEqual(json('native-suite-status.json'),{scope:'native-suite-exit-status-not-flow-verification',ordinaryTests:0,componentEvidence:0,localReplay:1});
  const primary=json('adb-pull-trip-change-parent-confirmation.json'), cleanup=json('adb-pull-failure-cleanup.json');
  assert.equal(primary.runId,review.runId);assert.equal(primary.phase,'trip-change-parent-confirmation');
  assert.equal(primary.completed,false);assert.equal(primary.status,1);assert.equal(primary.signal,null);
  assert.equal(cleanup.runId,review.runId);assert.equal(cleanup.phase,'failure-cleanup');assert.equal(cleanup.completed,true);assert.equal(cleanup.status,0);
  const server=sample=>sample.socketOwnership.processes.find(row=>row.connections.some(socket=>socket.listening&&socket.localPort===5037));
  const before=server(primary.hostBefore), after=server(primary.hostAfter), returned=server(cleanup.hostBefore);
  assert.equal(before.pid,3540);assert.equal(before.startTicks,'35634');assert.equal(after.pid,before.pid);assert.equal(after.startTicks,before.startTicks);
  const peer=row=>row.connections.find(socket=>!socket.listening&&socket.remotePort===5555);
  assert(peer(before));assert.equal(peer(after),undefined);assert.equal(returned.pid,before.pid);assert.notEqual(peer(returned).inode,peer(before).inode);
  const diagnostic=json('adb-sync-trip-change-parent-confirmation-diagnostics.json');assert.equal(diagnostic.runId,review.runId);
  for(const row of diagnostic.observations.slice(0,3)) {assert.equal(row.collected,false);assert.match(row.stderr,/device offline/);}
  const log=diagnostic.observations.find(row=>row.id==='storage-service-log');assert.equal(log.collected,true);
  const events=summarizeGuestAdbdEvents(log.value).events;assert.equal(events.length,7);
  assert(events.every(row=>row.pid===1715));assert.deepEqual([...new Set(events.map(row=>row.connection))],[18,19]);
  assert(events.some(row=>row.kind==='transport-write-failed'));assert(events.some(row=>row.kind==='read-thread-started'));
  const restored=json('disposable-store-restore.json');assert.equal(restored.restored,true);assert.equal(restored.verified,true);
  for(const key of ['localPackagesRemoved','background','stopped','launcher'])assert.equal(restored.restoration[key],true);
  assert.match(bytes('selected-job-lines.txt').toString(),/Android emulator version 37\.2\.13\.0/);
  assertRetainedSourceFiles(root,json('source-files.json'));
  return {ordinaryPassed:222,focusedPassed:11,capacityBlocksThisRun:false,primaryCopyPassed:false,fullNativeGateAccepted:false};
}
