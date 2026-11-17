import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export const alertCaptureFailureFolder='docs/release/evidence/alert-capture-failure-406e414-2026-11-01/';
export function validateAlertCaptureFailure(root,folder=alertCaptureFailureFolder) {
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);
  const review=json('review.json'),run=json('native-run.json'),artifact=json('artifact.json');
  assert.equal(review.scope,'failed-native-alert-capture-and-restart-copy-not-release-proof');
  assert.equal(review.testedAt,'2026-11-01');assert.equal(review.headSha,'406e414c66bdb17d73765a19499f45c66d8cd9dd');
  assert.equal(run.headSha,review.headSha);assert.equal(run.databaseId,41296148302);assert.equal(review.workflowId,run.databaseId);
  assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
  const failed=run.jobs.filter(job=>job.conclusion==='failure');assert.equal(failed.length,1);
  assert.equal(failed[0].name,'Android native UI tests');assert.equal(failed[0].databaseId,124817303914);
  assert.equal(failed[0].steps.find(step=>step.conclusion==='failure').name,'Run Android Compose UI tests');
  const focused=run.jobs.filter(job=>job.name.startsWith('Android focused safety UI tests / Isolated ')&&
    !job.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length,11);assert(focused.every(job=>job.conclusion==='success'));
  assert.equal(artifact.id,13080251827);assert.equal(artifact.name,'android-connected-ui-test-results');
  assert.equal(artifact.workflow_run.id,run.databaseId);assert.equal(artifact.workflow_run.head_sha,run.headSha);
  assert.match(artifact.digest,/^sha256:[a-f0-9]{64}$/);
  const ordinary=parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')),stored=json('ordinary-results.json');
  for(const [key,value]of Object.entries(ordinary))assert.deepEqual(stored[key],value);
  assert.deepEqual([ordinary.caseCount,ordinary.passed,ordinary.skipped,ordinary.failed],[280,225,54,1]);
  assert.deepEqual(review.ordinary,{passed:225,skipped:54,failed:1});
  const alerts=ordinary.cases.filter(row=>row.className==='be.sportgreenmoove.app.ui.NotificationInboxFlowTest');
  assert.equal(alerts.length,4);assert.equal(alerts.filter(row=>row.status==='passed').length,3);
  assert.equal(alerts.find(row=>row.status==='failed').name,'theNextAuthoritativeReadRemovesARevokedAlertWithoutAnOldHistoryCard');
  assert.match(read('ordinary-instrumentation.txt'),/Blank test capture rejected; use a rendering-enabled device image\./);
  assert.match(read('ordinary-instrumentation.txt'),/NotificationInboxFlowTest\.kt:39/);
  const xml=new XMLParser({ignoreAttributes:false}).parse(read('guarded-components.xml')).testsuite;
  assert.equal(Number(xml['@_tests']),280);assert.equal(Number(xml['@_failures']),1);assert.equal(Number(xml['@_skipped']),54);
  assert.deepEqual(json('native-suite-status.json'),{scope:'native-suite-exit-status-not-flow-verification',ordinaryTests:1,componentEvidence:0,localReplay:1});
  const rejected=json('rejected-primary-copy.json');assert.equal(rejected.collectionStatus,'not-observed');
  assert.equal(rejected.validatedPairCount,0);assert.equal(rejected.imageAccepted,false);assert.equal(rejected.copyAttempted,false);
  const copy=json('primary-copy.json');assert.equal(copy.runId,'1167ac913adf7fe9564a946abbb6115a');
  assert.equal(copy.phase,'confirmed-restart');assert.equal(copy.status,1);assert.equal(copy.completed,false);
  assert.equal(copy.signal,null);assert.equal(copy.errorCode,null);
  assert.deepEqual(copy.hostBefore.adbProcesses,copy.hostAfter.adbProcesses);
  assert(copy.hostAfter.daemonEvents.events.some(event=>event.kind==='connection-terminated-read-failed'));
  const diagnostics=json('sync-diagnostics.json');assert.equal(diagnostics.runId,copy.runId);
  assert.equal(diagnostics.observations.filter(row=>row.collected===false&&row.stderr.includes('device offline')).length,3);
  assert(diagnostics.observations.some(row=>row.value?.includes('connection terminated: write failed')));
  const restored=json('device-restoration.json');assert.equal(restored.case,'full-matrix');assert.equal(restored.verified,true);
  for(const key of ['authorizationRemoved','componentRemoved','originalPolicyRestored'])assert.equal(restored.restoration.installAdmin[key],true);
  assertRetainedSourceFiles(root,review.sourceFiles);
  assert.equal(review.notificationCasesPassed,3);assert.equal(review.notificationCaseRejectedAtCapture,true);
  for(const key of ['rejectedBitmapRetained','finalReplayReportPresent','sourceArchiveCompleteHeadAttestation',
    'downloadedArchiveDigestIndependentlyVerified','rootCauseProven','repairVerified','pushDeliveryVerified',
    'physicalPhoneEvidenceOverridden','releaseAccepted'])assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedCaptures,{});
  return review;
}
