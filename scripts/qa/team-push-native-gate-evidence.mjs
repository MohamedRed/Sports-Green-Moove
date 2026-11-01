import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
export const teamPushNativeGateFolder = 'docs/release/evidence/team-push-native-gate-94a3ffb-2026-11-01/';
export function validateTeamPushNativeGate(root, folder = teamPushNativeGateFolder) {
  const base = resolve(root, folder), read = file => readFileSync(resolve(base, file), 'utf8'), json = file => JSON.parse(read(file));
  assertEvidenceBundleChecksums(base); const report = json('review.json'), run = json('run.json'), artifact = json('artifact.json');
  assert.equal(report.scope, 'failed-native-capture-gate-not-runtime-or-release-proof');
  assert.equal(report.sourceCommit, '94a3ffb6c535264a8535184eda3f9b8dc01c54a2'); assert.equal(run.headSha, report.sourceCommit);
  assert.equal(run.databaseId, 41314916070); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.testedAt, run.updatedAt); assert.equal(report.testedAt.slice(0, 10), '2026-11-01');
  assert.equal(artifact.id, 13088201500); assert.equal(artifact.workflow_run.id, run.databaseId); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/); assert.equal(artifact.expired, false);
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ') && !job.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  for (const key of ['fullGatePassed', 'rootCauseConfirmed', 'physicalDevice', 'runtimeCallbacksExecuted', 'pushDeliveryVerified', 'releaseAccepted', 'rawArchiveDigestIndependentlyMatched'])
    assert.equal(report[key], false, key);
  assert.equal(report.privateStorageCasePassed, true); assert.deepEqual(report.publishedCaptures, {}); assertRetainedSourceFiles(root, report.sourceFiles);
  const parsed = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt')), original = json('ordinary-results.json');
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(original[key], value);
  assert.deepEqual(report.ordinary, {cases: 286, passed: 230, skipped: 54, failed: 2}); assert.equal(parsed.caseCount, 286); assert.equal(parsed.failed, 2);
  assert.deepEqual(parsed.cases.filter(row => row.status === 'failed').map(row => row.name).sort(),
    ['agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement', 'largeTextReviewKeepsCloseVisibleAfterScrollingToTheDecision']);
  assert.equal(parsed.cases.find(row => row.className.endsWith('.TeamPushPrivateStorageTest'))?.status, 'passed');
  assert(read('ordinary-instrumentation.txt').includes('Failed waiting for PixelCopy!'));
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 1, componentEvidence: 0, localReplay: 0});
  const restore = json('disposable-store-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  const observations = readdirSync(resolve(base, 'capture-diagnostics')).map(file => json('capture-diagnostics/' + file)); assert.equal(observations.length, 6);
  const failures = observations.filter(row => row.primaryOutcome === 'threw'); assert.equal(failures.length, 2);
  for (const row of observations) {
    assert.equal(row.sdkInvocations, 1); assert.equal(row.observerClosed, true); assert.equal(row.observerTerminationVerified, true);
    assert.equal(row.observerMayAffectScheduling, true); assert.equal(row.imagesWrittenByObserver, false);
  }
  for (const row of failures) assert.equal(row.errorCategory, 'pixelcopy-callback-wait');
  assert(failures.some(row => row.maxMainQueueDelayMs === 6));
  return report;
}
