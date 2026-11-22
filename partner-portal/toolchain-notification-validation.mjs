import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const toolchainNotificationFolder='docs/release/evidence/toolchain-notification-recheck-2026-11-01/';
export function validateToolchainNotificationRecheck(root,folder=toolchainNotificationFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const review=json('review.json');
  assert.equal(review.scope,'two-passing-transfer-comparisons-and-unexecuted-notification-observation-candidate');
  assert.equal(review.comparisonSourceCommit,'a55ed574a4717ab4f968d02c7a187be5271b37d9');
  assert.equal(review.transferPassesPerComparison,32);assert.equal(review.priorDefaultPassedTransfers,6);
  for(const key of ['versionCauseConfirmed','defaultProductToolchainChanged','wholeGatePassed','physicalDevice',
    'pushDeliveryVerified','nativeNotificationTapVerified','releaseAccepted','productionWrites'])assert.equal(review[key],false,key);
  assert.equal(review.providerRequests,0);assert.deepEqual(review.publishedCaptures,{});
  assert.deepEqual(review.comparisons.map(row=>[row.label,row.run,row.id,row.digest]),[
    ['pinned',41355051420,13102619642,'757ec6ee7b63c88f25a9baf2cfdee5f77a261a8b8dec4bf2d932a292e26f3ed1'],
    ['control',41355057116,13102644449,'24bb1a506763242aaba0ea671afbe5ad48ace3e670e9c1a7663241d37284c7d2'],
    ['failed',41353565294,13102725679,'b14c729b6079fd1338561d03b1ceaa2e3d7f64327e533a67ef7bbbec8c7eb511']]);
  for(const label of ['pinned','control','failed']){
    const run=json(label+'-result.json');assert.equal(run.scope,'isolated-generated-file-transfer-not-user-flow-or-release-proof');
    for(const key of ['appInstalled','accountsUsed','retryPerformed','alternateTransportUsed','rootCauseConfirmed','releaseAccepted'])
      assert.equal(run[key],false,key);
    assert.equal(run.plannedTrials,32);assert.equal(run.trials.length,label==='failed'?7:32);
    assert.equal(run.success,label!=='failed');assert.equal(run.completed,label!=='failed');
    assert.equal(run.cleanup.removed,true);assert.equal(run.cleanup.absenceVerified,true);
    for(const [index,trial]of run.trials.entries()){
      assert.equal(trial.index,index);const passed=label!=='failed'||index<6;
      assert.equal(trial.commandCompleted,passed);assert.equal(trial.integrityVerified,passed);
      assert.equal(trial.status,passed?0:1);assert.equal(trial.signal,null);assert.equal(trial.errorCode,null);
    }
  }
  const pinned=json('pinned-environment.json'),control=json('control-environment.json');
  assert.equal(pinned.versions.emulator,'37.2.13');assert.equal(control.versions.emulator,pinned.versions.emulator);
  assert.equal(pinned.toolchain.requested,'36.0.2');assert.equal(control.toolchain.requested,'sdk-default');
  assert.equal(pinned.toolchain.installed.version,'36.0.2');assert.equal(control.toolchain.installed.version,'37.0.1');
  assert.notEqual(pinned.toolchain.installed.adbSha256,control.toolchain.installed.adbSha256);
  assert.equal(pinned.toolchain.archive.sha256,'3afdea91441815ab41254193df0343d92c1b1c0d0237165c3a345c8af8891c31');
  for(const row of [pinned,control])for(const key of ['fallbackPerformed','productGateChanged','releaseAccepted'])assert.equal(row.toolchain[key],false);
  const native=review.nativeFailure;assert.equal(native.sourceCommit,'84cb6b209a646d6420395110e4eb5f9023aed12f');
  assert.equal(native.runId,41353565190);assert.equal(native.jobId,124988732484);
  assert.equal(native.routeCases,8);assert.equal(native.platformCases,4);assert.equal(native.failedPlatformCases,1);
  assert.match(read('routes.txt'),/OK \(8 tests\)/);assert.match(read('platform-failed.txt'),/TeamPushPlatformFlowTest.kt:70/);
  assert.match(read('platform-failed.txt'),/Tests run: 4,\s+Failures: 1/);
  assert.equal(json('permission-restored.json').restored,true);assert.equal(json('permission-restored.json').completed,false);
  assert.equal(json('device-restored.json').restored,true);assert.equal(json('device-restored.json').verified,true);
  const candidate=review.candidate;assert.equal(candidate.sourceUnchangedDuringBuild,true);
  assert.equal(candidate.platformCasesCompiled,4);assert.equal(candidate.instrumentationExecuted,false);
  assert.equal(candidate.notificationObservationDeadlineMs,5000);assert.equal(candidate.notificationCommandsRetried,false);
  assert.match(read('candidate-build.txt'),/BUILD SUCCESSFUL/);
  for(const files of [review.comparisonSources,native.sourceFiles,candidate.sourceFiles])assertRetainedSourceFiles(root,files);
  const file='android/app/src/androidTest/java/be/sportgreenmoove/app/services/TeamPushPlatformFlowTest.kt';
  const source=readFileSync(resolve(root,'docs/release/evidence/source-archive',candidate.sourceFiles[file]+'.txt'),'utf8');
  assert(source.includes('SystemClock.uptimeMillis() + 5_000'));assert(source.includes('val snapshot = manager.activeNotifications.toList()'));
  assert(source.includes('throw AssertionError("Notification service did not acknowledge $phase")'));
  assert(source.includes('val cleared = awaitNotifications'));assert(!source.includes('catch'));
  return review;
}
