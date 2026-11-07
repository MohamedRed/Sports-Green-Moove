import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const webFinalizationFolder = 'docs/release/evidence/web-finalization-2026-11-03/';
export function assertWebFinalizationScope(review) {
  assert.equal(review.scope, 'unchanged-source-web-diagnostic-pass-with-original-cancellation-and-native-failures-preserved');
  for (const [key, value] of Object.entries({checkedAt: '2026-11-03', webSource: 'c84b8e4a96f2f35d0b92f68b13904740b14d0dd3',
    currentChecksSource: '8bd9f503250ad022ae3d7b04b4248319f2c2a4d1', webRun: 41531744084,
    webAttempt: 2, webJob: 125595925328, webAggregate: 125607796006, webRecheckPassed: true})) assert.equal(review[key], value, key);
  for (const key of ['originalCancellationAccepted', 'originalCancellationCauseProven', 'workflowOrDeadlinesChanged',
    'nativeMainPassed', 'nativeChatPreparationPassed', 'fullNativeGatePassed', 'physicalDeviceAccepted',
    'parentApprovalAccepted', 'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
}
export function validateWebFinalization(root) {
  const folder = resolve(root, webFinalizationFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'); assertWebFinalizationScope(review);
  const run = json('web-run-attempt2.json'); assert.equal(run.id, review.webRun); assert.equal(run.run_attempt, 2);
  assert.equal(run.head_sha, review.webSource); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  const jobs = json('web-jobs-attempt2.json').jobs; assert.equal(jobs.length, 4);
  for (const job of jobs) {
    assert.equal(job.head_sha, review.webSource); assert.equal(job.run_id, run.id);
    assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  }
  assert.equal(jobs.filter(job => job.id === review.webJob).length, 1);
  assert.equal(jobs.find(job => job.id === review.webAggregate).name, 'Functions, admin, and website smoke');
  const boundary = bytes('web-success-boundary.txt').toString();
  assert.match(boundary, /Completed runner diagnostic log upload/); assert.match(boundary, /Cleaning up orphan processes/);
  assert.match(boundary, /##\[debug\]Finishing: Complete job/);
  assert.match(boundary, /##\[debug\]Finishing: Functions, admin, and website checks/);
  const checks = json('head-checks-8bd9f50.json').check_runs;
  assert.equal(checks.length, 30);
  for (const check of checks) {assert.equal(check.head_sha, review.currentChecksSource); assert.equal(check.status, 'completed');}
  const failures = checks.filter(row => row.conclusion === 'failure'); assert.equal(failures.length, 3);
  assert.deepEqual(failures.map(row => row.name).sort(), ['Android native UI tests',
    'Android focused safety UI tests / Isolated chat-network-recovery', 'Android focused safety UI tests / Isolated safety flows'].sort());
  assert.equal(checks.find(row => row.name === 'Functions, admin, and website smoke').conclusion, 'success');
  for (const [file, id, step] of [['native-main-job.json', 125598569095, 'Run Android Compose UI tests'],
    ['native-build-job.json', 125598569596, 'Compile isolated app before starting the device']]) {
    const job = json(file); assert.equal(job.id, id); assert.equal(job.head_sha, review.currentChecksSource);
    assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
    assert.equal(job.steps.find(row => row.name === step).conclusion, 'failure');
  }
  assert.match(bytes('native-primary-copy-failure.txt').toString(), /EvidenceCollectionError: Local evidence collection failed during trip-draft-restart; status=1, signal=null/);
  assert.match(bytes('native-dependency-failure.txt').toString(), /Could not find org.jetbrains.kotlin:kotlin-stdlib:2.0.21\./);
  const provenance = json('log-provenance.json'); assert.equal(provenance.rawLogsPublished, false);
  assert.equal(provenance.upstreamArchiveDigestIndependentlyVerified, false);
  assert.equal(provenance.downloadedArchiveSha256, '3d098021f35355be9ceda23cbef005f33a9f60ca80d41ddad681a1615aa8be99');
  assert.equal(provenance.downloadedArchiveBytes, 736830);
  return {webRecheckPassed: true, originalCancellationCauseProven: false, fullNativeGatePassed: false, releaseAccepted: false};
}
