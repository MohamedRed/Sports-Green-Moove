import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateAdminClientLifecycle(root, record) {
  const base = dirname(resolve(root, record.source)), read = name => JSON.parse(readFileSync(resolve(base, name)));
  const report = read('results.json'), prior = read('native-terminal-overview.json');
  assert.equal(record.checkedAt, report.testedAt.slice(0, 10));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'isolated-real-admin-sdk-lifecycle-not-native-ui');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.completed, true);
  for (const key of ['productionWrites', 'physicalDeviceAccepted', 'nativeReplayAccepted', 'releaseComplete'])
    assert.equal(report[key], false);
  assert.equal(report.isolatedEnvironmentDestroyed, true); assert.equal(report.emulatorEndpoints.closed, true);
  assert.deepEqual(report.cases.map(row => row.mode), ['before', 'after', 'task-error']);
  const [before, after, failure] = report.cases;
  assert.equal(before.observation.incompleteClientCleanupReproduced, true);
  assert.equal(before.observation.intentionallyStopped, true);
  assert.equal(before.report.registeredAppCount, 1);
  for (const row of [after, failure]) {
    assert.equal(row.observation.naturalExitObserved, true); assert.equal(row.report.registeredAppCount, 0);
    assert.equal(row.report.firestoreTerminationAcknowledged, true); assert.equal(row.report.appDeletionAcknowledged, true);
  }
  assert.equal(after.observation.successfulExit, true); assert.equal(failure.observation.successfulExit, false);
  assert.equal(failure.report.taskErrorPreserved, true);
  for (const row of report.cases) {
    assert.equal(row.report.runId, report.runId); assert.equal(row.report.forcedExitUsed, false);
    assert.equal(row.observation.groupExitVerified, true);
  }
  assert.equal(prior.runId, 40041012845); assert.equal(prior.workflowConclusion, 'cancelled');
  assert.match(prior.annotation, /maximum execution time of 35m0s/);
  assert.equal(prior.reportedPassedLocalSteps, 37); assert.equal(prior.reportedNativeCaseCount, 40);
  assert.equal(prior.cleanupCompletionAccepted, false); assert.equal(prior.allScenarioArtifactsIndependentlyValidated, false);
  const checksums = read('artifact-sha256.json');
  for (const [file, hash] of Object.entries(report.sourceFiles)) {
    assert.equal(checksums['source/' + file], hash);
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex'), hash);
  }
  assertEvidenceBundleChecksums(base); return report;
}
