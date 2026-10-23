import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateFocusedPreparationEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), read = file => readFileSync(resolve(base, file), 'utf8');
  const report = JSON.parse(read('summary.json')), run = JSON.parse(read('native-run.json'));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'terminal-native-matrix-success-with-one-focused-preparation-failure-not-release-acceptance');
  assert.equal(report.sourceCommit, 'fb628d5bb881c661a3dc174c7ed84c7843eb6b24'); assert.equal(run.headSha, report.sourceCommit);
  assert.equal(run.databaseId, 39946240705); assert.equal(report.runId, run.databaseId);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.matrixJobPassed, true);
  assert.equal(report.matrixJobId, 120389494908); assert.equal(report.failedFocusedJobId, 120389494845);
  assert.equal(run.jobs.find(job => job.databaseId === report.matrixJobId).conclusion, 'success');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ') && !job.name.endsWith('safety flows'));
  assert.equal(focused.length, 10); assert.equal(focused.filter(job => job.conclusion === 'success').length, 9);
  assert.equal(report.focusedCasesPassed, 9); assert.equal(report.focusedCasesFailed, 1);
  const failed = run.jobs.find(job => job.databaseId === report.failedFocusedJobId);
  assert.equal(failed.name, 'Android focused safety UI tests / Isolated team-read-components'); assert.equal(failed.conclusion, 'failure');
  assert.equal(failed.steps.find(step => step.name === 'Run one isolated safety flow on its own phone').conclusion, 'failure');
  assert.match(read('terminal-excerpt.txt'), /Ordinary Android matrix: 147 passed, 50 skipped, 0 failed; 197 cases observed/);
  assert.match(read('terminal-excerpt.txt'), /Ordinary tests: 0; component evidence: 0; local replay: 0/);
  assert.match(read('terminal-excerpt.txt'), /screen_off_timeout/);
  for (const key of ['fullCiPassed', 'physicalDeviceAccepted', 'allRestorationIndependentlyReviewed', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(report.newCapturesPublished, []); assertEvidenceBundleChecksums(base); return report;
}
