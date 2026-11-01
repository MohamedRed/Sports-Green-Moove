import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const foregroundReturnFolder='docs/release/evidence/foreground-return-intent-b9a9000-2026-11-01/';
export function validateForegroundReturnIntent(root,folder=foregroundReturnFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const report=json('review.json');
  assert.equal(report.scope,'source-supported-foreground-intent-mismatch-not-verified-native-replay');
  assert.equal(report.sourceCommit,'b9a9000ea7bac1bc9e8a3f1f0d83f9eb01229378');assert.equal(report.runId,41349573814);
  assert.equal(report.jobId,124976643675);assert.equal(report.previousTeardownCandidateFailed,true);assert.equal(report.sourceSupportedCause,true);
  assert.deepEqual(report.archive,{id:13100434670,sha256:'c496b674f0d5cf489bbebd62814eef841f8e87b45ebc1074b335149c8925ba89'});
  assert.deepEqual(report.library,{module:'androidx.test:core:1.6.1',
    aarSha256:'7a7af31c21785ddb7c4319c838847e6d4d9b5bb531f3a951481ec3b98780bf51',
    classesSha256:'693f6c75904659814cbc4204feae956376817e247597efd7997abcbb1e55737c'});
  for(const key of ['rootCauseReproducedInIsolation','correctedRemoteTrialPassed','wholeGatePassed','physicalDevice',
    'pushDeliveryVerified','releaseAccepted','productionWrites'])assert.equal(report[key],false,key);
  assert.equal(report.providerRequests,0);assert.deepEqual(report.publishedCaptures,{});
  assert.match(read('failed-instrumentation.txt'),/ActivityScenario.close/);assert.match(read('failed-instrumentation.txt'),/Tests run: 1,\s+Failures: 1/);
  assert.equal(json('checkpoint.json').appBackgrounded,true);assert.equal(json('checkpoint.json').peerCompletionAcknowledged,true);
  const restoration=json('device-restoration.json');assert.equal(restoration.restored,true);assert.equal(restoration.verified,true);
  assert(read('library-observer-filter.txt').includes('intent does not match'));
  for(const method of ['getAction','getData','getType','getPackage','getComponent','getCategories','getIdentifier'])
    assert(read('library-intent-match.txt').includes(method),method);
  const candidate=report.candidate;assert.equal(candidate.nativeCasesCompiled,2);assert.equal(candidate.nativeCasesExecuted,false);
  assert.equal(candidate.sourceUnchangedDuringBuild,true);assert.match(read('candidate-build.txt'),/BUILD SUCCESSFUL/);
  assertRetainedSourceFiles(root,report.originalSourceFiles);assertRetainedSourceFiles(root,candidate.sourceFiles);
  const source=file=>readFileSync(resolve(root,'docs/release/evidence/source-archive',candidate.sourceFiles[file]+'.txt'),'utf8');
  const ui='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  assert(source(ui+'ForegroundReturnIntent.kt').includes('Intent(launchIntent).setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)'));
  const test=source(ui+'LocalRemoteRideStopFlowTest.kt');assert(test.includes('trackedActivity.intent.filterEquals(launchIntent)'));
  assert(test.includes('assertEquals(Lifecycle.State.RESUMED, activity.state)'));assert(!test.includes('trackedActivity.finish()'));
  assert(source('android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt').includes('setIntent(intent)'));
  return report;
}
