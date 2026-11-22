import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const reviewBaselineGateFolder = 'docs/release/evidence/native-review-baseline-7e0e22e-2026-10-29/';
export const reviewBaselineHead = '7e0e22ed7b5c6b207085e942c47d3d3ad48a8d2f';
export function validateReviewBaselineGate(root, reference = {source: reviewBaselineGateFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewBaselineGateFolder + 'summary.json');
  const base = resolve(root, reviewBaselineGateFolder), text = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(text(file)); assertEvidenceBundleChecksums(base);
  const summary = json('summary.json'), run = json('native-run.json'), pr = json('pr-checks.json'), artifact = json('artifact.json');
  assert.equal(summary.scope, 'complete-enabled-ci-before-review-trip-context-not-current-implementation-release');
  assert.equal(summary.sourceCommit, reviewBaselineHead); assert.equal(summary.ciRunId, 40950260135);
  assert.equal(summary.nativeGatePassed, true);
  for (const key of ['newReviewContextCovered', 'physicalDeviceAccepted', 'newMediaAccepted', 'releaseComplete',
    'earlierTransportRootCauseConfirmed', 'productionWrites', 'safetyAuditAccepted']) assert.equal(summary[key], false, key);
  assert.equal(run.headSha, reviewBaselineHead); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert(run.url.endsWith('/40950260135')); assert.equal(run.jobs.length, 20);
  const skipped = ['Android approved real-map UI integration', 'Android approved vehicle-map UI',
    'Android approved parent search and booking', 'iOS native checks', 'iOS native UI tests'];
  assert.deepEqual(run.jobs.filter(job => job.conclusion === 'skipped').map(job => job.name).sort(), skipped.sort());
  assert(run.jobs.every(job => job.status === 'completed' && ['success', 'skipped'].includes(job.conclusion)));
  for (const name of ['Android native UI tests', 'Android native unit tests', 'Native UI flow coverage',
    'Android focused safety UI tests / Isolated safety flows']) assert.equal(run.jobs.find(job => job.name === name)?.conclusion, 'success');
  assert.equal(run.jobs.filter(job => job.name.includes(' / Isolated ') && !job.name.endsWith('safety flows')).length, 11);
  assert.equal(pr.headRefOid, reviewBaselineHead); assert.equal(pr.statusCheckRollup.length, 29);
  assert(pr.statusCheckRollup.every(check => check.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(check.conclusion)));
  assert.equal(artifact.id, 12931689988); assert.equal(artifact.workflow_run.id, summary.ciRunId);
  assert.equal(artifact.workflow_run.head_sha, reviewBaselineHead);
  const ordinary = parseAndroidJUnitTranscript(text('ordinary-instrumentation.txt')), stored = json('ordinary-results.json');
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(stored[key], value);
  assert.deepEqual([ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed], [247, 193, 54, 0]);
  const replay = json('replay/results.json'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.runId, 'a82ed7a3ce4dc3a3221f36df294696c9');
  assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40); assert.equal(replay.steps.length, 37);
  assert(replay.steps.every(step => step.status === 'passed')); assert.equal(replay.adminClientClosed, true);
  assert.equal(replay.firestoreClientTerminated, true);
  const transcripts = readdirSync(resolve(base, 'replay')).filter(file => file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 32); let cases = 0;
  for (const file of transcripts) {const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1; assertInstrumentationPassed(text('replay/' + file), count); cases += count;}
  assert.equal(cases, 40);
  const copies = readdirSync(resolve(base, 'replay')).filter(file => file.startsWith('adb-pull-'));
  assert.equal(copies.length, 17);
  for (const file of copies) {
    const copy = json('replay/' + file); assert.equal(copy.runId, replay.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
    assert.equal(file, 'adb-pull-' + copy.phase + '.json'); assert.notEqual(copy.phase, 'failure-cleanup');
  }
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const restore = json('device-restoration.json'); assert.equal(restore.case, 'full-matrix'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  return summary;
}
