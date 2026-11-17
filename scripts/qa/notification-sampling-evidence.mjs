import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {validateRejectedPrimaryBitmaps} from './rejected-primary-captures.mjs';

export const notificationSamplingFolder='docs/release/evidence/notification-sampling-59dbd3c-2026-11-01/';
export function validateNotificationSampling(root,folder=notificationSamplingFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file)),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const review=json('review.json'),run=json('native-run.json'),artifact=json('artifact.json');
  assert.equal(review.scope,'retained-failed-gate-with-proven-sparse-sampling-false-rejection');
  assert.equal(review.headSha,'59dbd3c292a767ded035826fd2a9f8630f1a4620');assert.equal(review.workflowId,41299644811);
  assert.equal(run.headSha,review.headSha);assert.equal(run.databaseId,review.workflowId);
  assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
  const failed=run.jobs.filter(row=>row.conclusion==='failure');assert.equal(failed.length,1);
  assert.equal(failed[0].name,'Android native UI tests');assert.equal(failed[0].databaseId,124827743691);
  const focused=run.jobs.filter(row=>row.name.startsWith('Android focused safety UI tests / Isolated ')&&!row.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length,11);assert(focused.every(row=>row.conclusion==='success'));
  assert.equal(artifact.id,13081302612);assert.equal(artifact.name,'android-connected-ui-test-results');
  assert.equal(artifact.workflow_run.id,run.databaseId);assert.equal(artifact.workflow_run.head_sha,run.headSha);
  const ordinary=parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt').toString()),stored=json('ordinary-results.json');
  for(const [key,value]of Object.entries(ordinary))assert.deepEqual(stored[key],value);
  assert.deepEqual([ordinary.caseCount,ordinary.passed,ordinary.skipped,ordinary.failed],[281,226,54,1]);
  assert.equal(ordinary.cases.find(row=>row.status==='failed').name,'theNextAuthoritativeReadRemovesARevokedAlertWithoutAnOldHistoryCard');
  assert.match(read('ordinary-instrumentation.txt').toString(),/Blank test capture rejected/);
  assert.deepEqual(json('native-suite-status.json'),{scope:'native-suite-exit-status-not-flow-verification',ordinaryTests:1,componentEvidence:0,localReplay:0});
  assert.equal(json('rejected-primary-copy.json').validatedPairCount,1);
  assert.equal(validateRejectedPrimaryBitmaps(resolve(base,'rejected')).pairCount,1);
  const stem='rejected/notification-inbox-revoked-308240241406',marker=json(stem+'.json'),decoded=json('decoded-pixels.json');
  assert.equal(marker.sampledColorCount,10);assert.equal(marker.sampleStride,16);
  assert.equal(decoded.scope,'local-decoder-analysis-not-ui-replay');assert.equal(decoded.decoder,'ffmpeg rawvideo rgba');
  assert.equal(decoded.imageSha256,marker.imageSha256);assert.equal(decoded.allDistinctColors,260);assert.equal(decoded.stride16DistinctColors,10);
  assert.equal(decoded.pixels,2592000);assert.equal(decoded.originalThresholdExclusive,16);
  assert.equal(decoded.originalSamplePredicate,false);assert.equal(decoded.fullPixelPredicate,true);
  assert.equal(decoded.imageModified,false);assert.equal(decoded.recaptured,false);
  const fixture=readFileSync(resolve(root,'android/app/src/androidTest/assets/qa/notification-empty-state.png'));
  assert.equal(createHash('sha256').update(fixture).digest('hex'),marker.imageSha256);
  assert.equal(json('disposable-store-restore.json').verified,true);
  const replay=json('replay/results.json');assert.equal(replay.testCount,37);assert.equal(replay.nativeCaseCount,40);
  assert.equal(replay.steps.length,37);assert.equal(replay.adminClientClosed,true);assert.equal(replay.firestoreClientTerminated,true);
  const copies=readdirSync(resolve(base,'replay')).filter(file=>file.startsWith('adb-pull-'));assert.equal(copies.length,17);
  for(const file of copies){const row=json('replay/'+file);assert.equal(row.runId,replay.runId);assert.equal(row.completed,true);assert.equal(row.status,0);}
  assertRetainedSourceFiles(root,review.sourceFiles);assert.equal(review.rejectedBitmapRetained,true);assert.equal(review.samplingFalseRejectionProven,true);
  for(const key of ['repairVerified','downloadedArchiveDigestIndependentlyVerified','wholeHeadAttested','pushDeliveryVerified','releaseAccepted'])assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedCaptures,{});return review;
}
