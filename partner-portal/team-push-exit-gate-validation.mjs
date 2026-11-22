import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';
import {assertInstrumentationPassed} from '../scripts/qa/android-instrumentation-result.mjs';

export const exitGateFolder = 'docs/release/evidence/native-team-push-exit-gate-a2e3e19-2026-11-01/';
export function validateExitGate(root, folder = exitGateFolder) {
  const base = resolve(root, folder), read = file => readFileSync(resolve(base, file), 'utf8'), json = file => JSON.parse(read(file));
  assertEvidenceBundleChecksums(base); const run = json('run.json'), review = json('review.json'), artifact = json('artifact.json');
  assert.equal(run.databaseId, 41325676113); assert.equal(run.headSha, 'a2e3e19e3db59fdcb870fb92ca0a1d7438a814f2');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(review.sourceCommit, run.headSha); assert.equal(review.testedAt, run.updatedAt);
  assert.equal(review.scope, 'failed-wide-capture-contract-and-network-copy-not-release-proof');
  assert.equal(artifact.id, 13092501621); assert.equal(artifact.workflow_run.id, run.databaseId); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith('/ Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'failure');
  for (const key of ['fullGatePassed', 'wideExitCasePassed', 'correctedLandscapeArgumentExecuted', 'networkEvidenceCopyCompleted',
    'networkCopyRootCauseConfirmed', 'rawArchiveDigestIndependentlyMatched', 'physicalDevice', 'pushDeliveryVerified', 'releaseAccepted'])
    assert.equal(review[key], false, key);
  for (const key of ['narrowExitCasePassed', 'pendingExitHidesAccountCasePassed', 'testCaptureOrientationCauseConfirmed', 'networkInstrumentationPassed'])
    assert.equal(review[key], true, key);
  assert.deepEqual(review.focused, {lanes: 11, passed: 11, failed: 0}); assert.deepEqual(review.publishedCaptures, {});
  assert.deepEqual(review.visualReview, {narrowReadable: true, wideAvailable: false});
  const ordinary = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')), stored = json('ordinary-results.json');
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(stored[key], value);
  assert.deepEqual(review.ordinary, {cases: 289, passed: 234, skipped: 54, failed: 1}); assert.equal(ordinary.failed, 1);
  assert.equal(ordinary.cases.find(row => row.status === 'failed').name, 'wideDarkExitScreenKeepsTheStatusInsideItsFrame');
  assert(read('ordinary-instrumentation.txt').includes('Capture orientation does not match the tested layout.'));
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 1});
  assertInstrumentationPassed(read('network-instrumentation.txt'), 1);
  for (const [file, phase] of [['network-copy.json', 'network-recovery'], ['cleanup-copy.json', 'failure-cleanup']]) {
    const copy = json(file); assert.equal(copy.phase, phase); assert.equal(copy.completed, false); assert.equal(copy.status, 1);
    assert.equal(copy.runId, 'c6dff88cbcd245e247b05e3ccde61b76');
  }
  const restore = json('restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assertRetainedSourceFiles(root, review.sourceFiles);
  return review;
}
