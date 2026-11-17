import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {focusedCases} from './android-case-apks.mjs';
import {compareTransferGuests} from '../diagnostics/adb-transfer-guest.mjs';

export const fullNativePassFolder='docs/release/evidence/full-native-5091ec5-2026-10-31/';
export function assertFullNativePassReview(review) {
  assert.equal(review.scope,'source-specific-complete-native-pass-and-successful-guest-observation-not-intermittency-repair-or-release');
  for(const [key,value] of Object.entries({nativeSource:'5091ec5fc7e9075be370817af2f211c78e7c3a98',nativeRun:41249409056,
    nativeJob:124679576475,replayRunId:'18f96e79c2562c0d6205a25710c38f42',ordinaryPassed:222,ordinarySkipped:54,
    ordinaryFailed:0,replayGroups:37,replayNativeCases:40,primaryCopies:17,focusedJobs:11,
    probeSource:'e7a1e34ecbd31f24c2526ea15d5366a614b2ae92',probeRun:41250843194,probeTransfersPassed:32})) assert.equal(review[key],value,key);
  for(const key of ['sourceSpecificFullGatePassed','guestIdentityMeasured','sameGuestBootAndAdbdBirthInSamples']) assert.equal(review[key],true,key);
  for(const key of ['guestObservationDuringFailure','continuousGuestExecutionProven','underlyingCauseConfirmed',
    'earlierCopyFailureRepaired','passAttributedToObservation','currentHeadGateAccepted','physicalDeviceAccepted',
    'productionWrites','releaseAccepted']) assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedMedia,[]);
}
export function validateFullNativePass(root) {
  const folder=resolve(root,fullNativePassFolder),bytes=file=>readFileSync(resolve(folder,file)),json=file=>JSON.parse(bytes(file));
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assertEvidenceBundleChecksums(folder);
  const review=json('review.json');assertFullNativePassReview(review);
  const run=json('native-run.json'),jobs=json('native-jobs.json'),checks=json('head-checks.json');
  assert.equal(run.id,review.nativeRun);assert.equal(run.head_sha,review.nativeSource);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
  assert.equal(jobs.total_count,jobs.jobs.length);assert.equal(jobs.jobs.length,20);
  const skipped=['iOS native UI tests','iOS native checks','Android approved real-map UI integration',
    'Android approved vehicle-map UI','Android approved parent search and booking'];
  assert.deepEqual(jobs.jobs.filter(row=>row.conclusion==='skipped').map(row=>row.name).sort(),[...skipped].sort());
  for(const row of jobs.jobs) {
    assert.equal(row.head_sha,review.nativeSource);assert.equal(row.run_id,run.id);assert.equal(row.status,'completed');
    assert.equal(row.conclusion,skipped.includes(row.name)?'skipped':'success');
  }
  const main=jobs.jobs.find(row=>row.id===review.nativeJob);assert.equal(main.name,'Android native UI tests');
  for(const name of focusedCases) assert.equal(jobs.jobs.filter(row=>row.name==='Android focused safety UI tests / Isolated '+name).length,1);
  for(const name of ['Android native unit tests','Native UI flow coverage','Android focused safety UI tests / Isolated safety flows'])
    assert.equal(jobs.jobs.filter(row=>row.name===name&&row.conclusion==='success').length,1);
  assert.equal(checks.total_count,27);assert.equal(checks.check_runs.length,27);
  assert.deepEqual(checks.check_runs.filter(row=>row.conclusion==='skipped').map(row=>row.name).sort(),[...skipped].sort());
  for(const row of checks.check_runs) {assert.equal(row.head_sha,review.nativeSource);assert.equal(row.status,'completed');
    assert.equal(row.conclusion,skipped.includes(row.name)?'skipped':'success');}
  for(const name of ['Functions and Firebase rules','Functions, admin, and website checks','People and safety service smoke',
    'Production provider secret validation','Store readiness static checks','Generated-file transport (not release)'])
    assert.equal(checks.check_runs.filter(row=>row.name===name&&row.conclusion==='success').length,1);
  const archives=json('archive-verification.json');assert.equal(archives.originalArchivesPublished,false);
  assert.equal(Object.keys(archives.main.members).length,58);assert.equal(Object.keys(archives.probe.members).length,35);
  for(const [kind,id,digest,size,head,runId] of [
    ['native',13061660021,'b88160630e1062be0384d9fc1ddab0af578f5b043d8ce3cc01dd7be7321165dc',26841148,review.nativeSource,review.nativeRun],
    ['probe',13061590079,'6d9bcf8a10a4c294f60148bb1b1c3824a5cd29bc576da873742ba2435793186b',15930,review.probeSource,review.probeRun],
  ]) {
    const artifact=json(kind+'-artifact.json'),record=archives[kind==='native'?'main':'probe'];
    assert.equal(artifact.id,id);assert.equal(artifact.digest,'sha256:'+digest);assert.equal(artifact.size_in_bytes,size);
    assert.equal(artifact.workflow_run.head_sha,head);assert.equal(artifact.workflow_run.id,runId);
    assert.equal(record.digest,artifact.digest);assert.equal(record.size,size);
    for(const [file,member] of Object.entries(record.members)) {
      const expected=kind==='probe'?file.slice('probe/'.length):file.startsWith('main/replay/')?
        'outputs/local-ui-evidence/'+review.replayRunId+'/'+file.slice('main/replay/'.length):file==='main/host-disk-capacity.json'?
        'outputs/host-disk-capacity.json':'outputs/store-review-screenshots/'+file.slice('main/'.length);
      assert.equal(member.member,expected,file);assert.equal(sha(bytes(file)),member.sha256,file);
    }
  }
  const ordinary=parseAndroidJUnitTranscript(bytes('main/ordinary-instrumentation.txt').toString());
  for(const [key,value] of Object.entries(ordinary)) assert.deepEqual(json('main/ordinary-results.json')[key],value,key);
  assert.equal(ordinary.passed,222);assert.equal(ordinary.skipped,54);assert.equal(ordinary.failed,0);
  assert.equal(json('main/ordinary-results.json').guardConfirmed,true);assert.equal(json('main/ordinary-process.json').status,0);
  assert.deepEqual(json('main/native-suite-status.json'),{scope:'native-suite-exit-status-not-flow-verification',ordinaryTests:0,componentEvidence:0,localReplay:0});
  const replay=json('main/replay/results.json');assert.equal(replay.scope,'local-ui-not-physical-device');assert.equal(replay.runId,review.replayRunId);
  assert.equal(replay.testCount,37);assert.equal(replay.nativeCaseCount,40);
  const earlier=JSON.parse(readFileSync(resolve(root,'docs/release/evidence/transfer-lifecycle-2026-10-31/native-main/replay/results.json')));
  assert.deepEqual(replay.steps,earlier.steps);assert(replay.steps.every(row=>row.status==='passed'));
  assert.equal(replay.adminClientClosed,true);assert.equal(replay.firestoreClientTerminated,true);
  const files=readdirSync(resolve(folder,'main/replay')),transcripts=files.filter(file=>file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length,32);let cases=0;
  for(const file of transcripts) {const count=file.startsWith('LocalAppFlowTest-')?9:1;assertInstrumentationPassed(bytes('main/replay/'+file).toString(),count);cases+=count;}
  assert.equal(cases,40);
  const copies=files.filter(file=>file.startsWith('adb-pull-'));assert.equal(copies.length,17);
  for(const file of copies) {const copy=json('main/replay/'+file);assert.equal(copy.runId,replay.runId);
    assert.equal(copy.completed,true);assert.equal(copy.status,0);assert.equal(copy.signal,null);assert.equal(copy.errorCode,null);
    assert.notEqual(copy.phase,'failure-cleanup');assert.equal(file,'adb-pull-'+copy.phase+'.json');}
  assert.equal(replay.matrixPreparation.receiptSha256,sha(bytes('main/disposable-device-setup.json')));
  assert.deepEqual(replay.matrixPreparation.apkHashes,json('main/disposable-device-setup.json').apkHashes);
  assert.equal(replay.matrixPreparation.installationsRemainedBlocked,true);
  const restore=json('main/disposable-store-restore.json');assert.equal(restore.restored,true);assert.equal(restore.verified,true);
  for(const key of ['localPackagesRemoved','background','stopped','launcher']) assert.equal(restore.restoration[key],true,key);
  for(const key of ['authorizationRemoved','componentRemoved','originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key],true,key);
  const probeRun=json('probe-run.json'),probeJobs=json('probe-jobs.json');
  assert.equal(probeRun.id,review.probeRun);assert.equal(probeRun.head_sha,review.probeSource);assert.equal(probeRun.status,'completed');assert.equal(probeRun.conclusion,'success');
  assert.equal(probeJobs.total_count,1);assert.equal(probeJobs.jobs[0].head_sha,review.probeSource);assert.equal(probeJobs.jobs[0].conclusion,'success');
  const probe=json('probe/result.json');assert.equal(probe.plannedTrials,32);assert.equal(probe.completed,true);assert.equal(probe.success,true);assert.equal(probe.trials.length,32);
  for(const row of probe.trials) {assert.equal(row.commandCompleted,true);assert.equal(row.integrityVerified,true);
    assert.deepEqual(row,json('probe/trial-'+String(row.index).padStart(2,'0')+'.json'));}
  for(const key of ['appInstalled','accountsUsed','retryPerformed','alternateTransportUsed','rootCauseConfirmed','releaseAccepted']) assert.equal(probe[key],false,key);
  assert.equal(probe.cleanup.absenceVerified,true);
  for(const guest of [probe.guestBefore,probe.guestAfter]) {
    assert.equal(guest.completed,true);assert.match(guest.identity.bootIdSha256,/^[a-f0-9]{64}$/);assert.equal(guest.identity.pid,1880);assert.equal(guest.identity.startedTicks,'3099');
    assert.equal(guest.commands.length,6);assert(guest.commands.every(row=>row.completed&&row.reason===null));
    assert.deepEqual(guest.events.events,[]);
    for(const key of ['rawLogsRetained','rawBootIdRetained','argumentsRead','environmentRead','deviceMutationRequested','retryPerformed','continuityProven','rootCauseConfirmed']) assert.equal(guest[key],false,key);
  }
  assert.deepEqual(probe.guestBefore.identity,probe.guestAfter.identity);
  assert.deepEqual(probe.guestComparison,compareTransferGuests(probe.guestBefore,probe.guestAfter));assert.equal(probe.guestComparison.sameAdbdBirthObserved,true);
  for(const files of Object.values(json('source-files.json'))) assertRetainedSourceFiles(root,files);
  return {sourceSpecificFullGatePassed:true,ordinaryPassed:222,replayGroups:37,replayNativeCases:40,primaryCopies:17,
    focusedJobs:11,probeTransfers:32,intermittencyRepaired:false,physicalDeviceAccepted:false,releaseAccepted:false};
}
