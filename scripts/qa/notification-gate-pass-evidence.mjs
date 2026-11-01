import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
export const notificationGateFolder='docs/release/evidence/notification-gate-d476cce-2026-11-01/';
export function validateNotificationGate(root,folder=notificationGateFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file)),json=file=>JSON.parse(read(file));assertEvidenceBundleChecksums(base);
  const review=json('review.json'),run=json('native-run.json'),artifact=json('artifact.json'),checks=json('head-checks.json');
  assert.equal(review.scope,'source-specific-notification-capture-correction-full-native-pass-not-release');
  assert.equal(review.headSha,'d476cce5a4210e0d6e2dc95668d8f875cdefed73');assert.equal(review.workflowId,41303552983);
  assert.equal(run.headSha,review.headSha);assert.equal(run.databaseId,review.workflowId);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');
  const skipped=['iOS native UI tests','iOS native checks','Android approved real-map UI integration','Android approved vehicle-map UI','Android approved parent search and booking'];
  assert.equal(run.jobs.length,20);for(const row of run.jobs)assert.equal(row.conclusion,skipped.includes(row.name)?'skipped':'success');
  const main=run.jobs.find(row=>row.databaseId===review.mainJobId);assert.equal(main.name,'Android native UI tests');
  assert.equal(main.steps.find(row=>row.name==='Run Android Compose UI tests').conclusion,'success');
  const focused=run.jobs.filter(row=>row.name.startsWith('Android focused safety UI tests / Isolated ')&&!row.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length,11);assert(focused.every(row=>row.conclusion==='success'));
  assert.equal(checks.total_count,checks.check_runs.length);
  for(const row of checks.check_runs){assert.equal(row.head_sha,review.headSha);assert.equal(row.status,'completed');assert(['success','skipped'].includes(row.conclusion));}
  for(const name of ['Functions and Firebase rules','Functions, admin, and website checks','People and safety service smoke',
    'Production provider secret validation','Store readiness static checks','Generated-file transport (not release)'])
    assert(checks.check_runs.some(row=>row.name===name&&row.conclusion==='success'),name);
  assert.equal(artifact.id,13083535043);assert.equal(artifact.workflow_run.id,run.databaseId);assert.equal(artifact.workflow_run.head_sha,run.headSha);
  const parsed=parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt').toString()),ordinary=json('ordinary-results.json');
  for(const [key,value]of Object.entries(parsed))assert.deepEqual(ordinary[key],value);
  assert.deepEqual([parsed.caseCount,parsed.passed,parsed.skipped,parsed.failed],[285,231,54,0]);assert.equal(ordinary.guardConfirmed,true);
  for(const [name,count]of [['NotificationInboxFlowTest',4],['PrimaryCaptureColorsTest',3],['MessagesNotificationRetryFlowTest',1]]){
    const rows=parsed.cases.filter(row=>row.className==='be.sportgreenmoove.app.ui.'+name);assert.equal(rows.length,count);assert(rows.every(row=>row.status==='passed'));
  }
  const xml=new XMLParser({ignoreAttributes:false}).parse(read('guarded-components.xml')).testsuite;
  assert.equal(Number(xml['@_tests']),285);assert.equal(Number(xml['@_failures']),0);assert.equal(Number(xml['@_skipped']),54);
  assert.deepEqual(json('native-suite-status.json'),{scope:'native-suite-exit-status-not-flow-verification',ordinaryTests:0,componentEvidence:0,localReplay:0});
  const replay=json('replay/results.json');assert.equal(replay.runId,review.replayRunId);assert.equal(replay.testCount,37);assert.equal(replay.nativeCaseCount,40);
  assert.equal(replay.steps.length,37);assert(replay.steps.every(row=>row.status==='passed'));assert.equal(replay.adminClientClosed,true);assert.equal(replay.firestoreClientTerminated,true);
  const files=readdirSync(resolve(base,'replay')),copies=files.filter(file=>file.startsWith('adb-pull-')),transcripts=files.filter(file=>file.endsWith('-instrumentation.txt'));
  assert.equal(copies.length,17);assert.equal(transcripts.length,32);let nativeCases=0;
  for(const file of copies){const copy=json('replay/'+file);assert.equal(copy.runId,replay.runId);assert.equal(copy.completed,true);assert.equal(copy.status,0);assert.equal(copy.signal,null);assert.equal(copy.errorCode,null);}
  for(const file of transcripts){const count=file.startsWith('LocalAppFlowTest-')?9:1;assertInstrumentationPassed(read('replay/'+file).toString(),count);nativeCases+=count;}
  assert.equal(nativeCases,40);
  const setup=read('disposable-device-setup.json');assert.equal(replay.matrixPreparation.receiptSha256,createHash('sha256').update(setup).digest('hex'));
  assert.deepEqual(replay.matrixPreparation.apkHashes,JSON.parse(setup).apkHashes);assert.equal(replay.matrixPreparation.installationsRemainedBlocked,true);
  const restored=json('disposable-store-restore.json');assert.equal(restored.verified,true);assert.equal(restored.restored,true);
  for(const key of ['localPackagesRemoved','background','stopped','launcher'])assert.equal(restored.restoration[key],true,key);
  for(const key of ['authorizationRemoved','componentRemoved','originalPolicyRestored'])assert.equal(restored.restoration.installAdmin[key],true,key);
  assertRetainedSourceFiles(root,review.sourceFiles);
  for(const key of ['sourceSpecificFullGatePassed','sourceSpecificAllChecksPassed','captureCorrectionVerifiedAtSource'])assert.equal(review[key],true,key);
  for(const key of ['downloadedArchiveDigestIndependentlyVerified','wholeHeadAttested','earlierTransportFailuresRepaired','intermittentTransportCauseProven',
    'physicalDeviceAccepted','pushDeliveryVerified','productionWrites','releaseAccepted'])assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedCaptures,{});return review;
}
