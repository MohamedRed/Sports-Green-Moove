import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {assertInstrumentationPassed} from '../scripts/qa/android-instrumentation-result.mjs';

export const sessionExitComponentsFolder = 'docs/release/evidence/session-exit-components-f8a3990-2026-11-01/';
export function validateSessionExitComponents(root, folder = sessionExitComponentsFolder) {
  const base = resolve(root, folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const sha = value => createHash('sha256').update(value).digest('hex');
  assertEvidenceBundleChecksums(base);
  const result = json('results.json'), review = json('review.json'), job = json('job.json'), artifact = json('artifact.json');
  assert.equal(review.scope, 'reviewed-session-exit-components-not-full-gate-phone-or-delivery');
  assert.equal(review.sourceCommit, 'f8a399009c8dcfea20cccf22aa44ef7a519c9575');
  assert.equal(review.testedAt, result.testedAt); assert.equal(review.testedAt.slice(0, 10), '2026-11-01');
  assert.equal(job.id, 124917807736); assert.equal(job.run_id, 41329969631); assert.equal(job.id, review.jobId);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success'); assert.equal(job.head_sha, review.sourceCommit);
  assert.equal(artifact.id, 13093855021); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, review.sourceCommit); assert.equal(artifact.expired, false);
  assert.equal(artifact.digest, 'sha256:ac565a5247c8d00afeed850e91407934659610024f45155ab64c91daa0dd2781');
  assert.equal(artifact.digest, 'sha256:' + review.archiveSha256);
  for (const key of ['rawArchiveDigestIndependentlyMatched', 'captureGuardUnchanged', 'correctedOrientationCallExecuted']) assert.equal(review[key], true, key);
  for (const key of ['fullAppSystemInsetsVerified', 'fullGatePassed', 'physicalDevice', 'pushDeliveryVerified', 'tapNavigationVerified',
    'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(review.realMessagingSdkCalls, 0); assert.deepEqual(review.publishedCaptures, {});
  assert.equal(result.scope, 'isolated-session-exit-components-not-phone-or-delivery');
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.equal(result.runId, 'bbca96066b245ebc22b4ff3a8279b6b7');
  assert.equal(result.componentCaseCount, 3); assert.equal(result.nativeUiExecuted, true);
  for (const key of ['physicalDevice', 'productionWrites', 'pushDeliveryVerified']) assert.equal(result[key], false, key);
  assert.equal(result.realMessagingSdkCalls, 0); assert.equal(review.componentCasesPassed, 3);
  assert.equal(review.originalReadCasesPreserved, 3); assert.equal(json('original-read-results.json').componentCaseCount, 3);
  assert.deepEqual(review.sourceFiles, result.sourceFiles); assert.equal(Object.keys(result.sourceFiles).length, 8);
  assertRetainedSourceFiles(root, result.sourceFiles);
  const capturePath = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt';
  const previous = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/native-team-push-exit-gate-a2e3e19-2026-11-01/review.json')));
  assert.equal(result.sourceFiles[capturePath], previous.sourceFiles[capturePath]);
  const transcript = bytes('instrumentation.txt').toString(); assertInstrumentationPassed(transcript, 3);
  assert(transcript.includes('be.sportgreenmoove.app.ui.SessionShutdownFlowTest:...'));
  assert(transcript.includes('INSTRUMENTATION_STATUS: sgm_installations_blocked=true'));
  assert.equal(result.transcriptSha256, sha(bytes('instrumentation.txt')));
  const expected = {'session-exit-narrow.png': [735, 2400], 'session-exit-wide-dark.png': [1575, 1080]};
  assert.deepEqual(Object.keys(result.screenshots).sort(), Object.keys(expected).sort());
  assert.deepEqual(Object.keys(review.visualReview).sort(), Object.keys(expected).sort());
  for (const [file, [width, height]] of Object.entries(expected)) {
    const image = bytes(file); assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(sha(image), result.screenshots[file]); assert.equal(image.readUInt32BE(16), width); assert.equal(image.readUInt32BE(20), height);
    assert.deepEqual(review.visualReview[file], {width, height, readable: true, unoccluded: true});
  }
  const copy = json('copy.json'); assert.equal(copy.runId, result.runId); assert.equal(copy.phase, 'session-shutdown');
  assert.equal(copy.completed, true); assert.equal(copy.status, 0); assert.equal(copy.signal, null);
  assert.equal(result.setupReceiptSha256, sha(bytes('setup.json')));
  assert.equal(json('setup.json').case, 'team-read-components'); assert.equal(json('suite-status.json').status, 0);
  assert.equal(result.cleanupOwner, 'focused-shell-independent-restoration-receipt-required');
  const restore = json('restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true); assert.equal(restore.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  assert.equal(Object.keys(review.archiveEntries).length, 9);
  for (const [file, record] of Object.entries(review.archiveEntries)) assert.equal(sha(bytes(file)), record.sha256);
  return review;
}
