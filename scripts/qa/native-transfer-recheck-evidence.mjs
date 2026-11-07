import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeTransferRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), read = name => readFileSync(resolve(base, name), 'utf8');
  const report = JSON.parse(read('summary.json')), run = JSON.parse(read('native-run.json'));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'terminal-native-recheck-with-incomplete-full-replay-during-evidence-transfer');
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.checkedAt, '2026-10-23');
  assert.equal(report.sourceCommit, '6441dca55622ea8370051361047f779a9b7b26f2');
  assert.equal(run.headSha, report.sourceCommit); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(report.runId, 39873579268); assert(run.url.endsWith('/' + report.runId));
  assert.equal(report.matrixJobId, 120153608819);
  assert.equal(run.jobs.find(job => job.databaseId === report.matrixJobId).conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ') && !job.name.endsWith('safety flows'));
  assert.equal(focused.length, 10); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(report.focusedCasesPassed, focused.length);
  assert.equal(run.jobs.find(job => job.name.endsWith('/ Isolated safety flows')).conclusion, 'success');
  const excerpt = read('failed-step-excerpt.txt');
  assert.match(excerpt, /Ordinary Android matrix: 147 passed, 50 skipped, 0 failed; 197 cases observed/);
  assert.match(excerpt, /LocalTripChangeFlowTest:\./); assert.match(excerpt, /OK \(1 test\)/);
  assert.match(excerpt, /EvidenceCollectionError: Local evidence collection failed during trip-change-parent-confirmation; status=1/);
  assert.match(excerpt, /Ordinary tests: 0; component evidence: 0; local replay: 1/);
  assert.equal(report.failedCollectionPhase, 'trip-change-parent-confirmation');
  assert.equal(report.ordinaryCases, 197); assert.equal(report.ordinaryPassed, 147); assert.equal(report.ordinarySkipped, 50);
  for (const key of ['fullNativeReplayCompleted', 'fullCiPassed', 'transferRootCauseEstablished', 'allRestorationVerified',
    'physicalDeviceAccepted', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.deepEqual(report.newCapturesPublished, []); assertEvidenceBundleChecksums(base); return report;
}
