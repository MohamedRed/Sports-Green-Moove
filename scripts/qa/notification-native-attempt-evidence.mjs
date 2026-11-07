import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertNotificationReadRestart } from './notification-read-restart-evidence.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationNativeAttempt(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json'), run = json('native-run.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'terminal-notification-native-attempt-with-failed-primary-collection-not-full-replay');
  assert.equal(run.databaseId, 40014947968); assert.equal(run.headSha, '3a5b5d3ddf4cbda20601ece9eeaf56c144a4ca53');
  assert.equal(report.sourceCommit, run.headSha); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === 120624500189).conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, 12529380747); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  const ordinary = json('ordinary-results.json');
  assert.equal(ordinary.passed, 157); assert.equal(ordinary.skipped, 52); assert.equal(ordinary.failed, 1);
  const cases = ordinary.cases;
  assert(Array.isArray(cases));
  const notification = cases.filter(row => row.className.endsWith('.NotificationReadFlowTest'));
  assert.equal(notification.length, 4); assert(notification.every(row => row.status === 'passed'));
  assert.match(bytes('ordinary-instrumentation.txt').toString(), /forceRedraw/);
  assert.match(bytes('ordinary-instrumentation.txt').toString(), /TripChangeFlowTest\.agreementStillRequiresRouteAndApplicationAndDoesNotClaimSettlement/);
  const before = json('local-notification-read-before.json'), stopped = json('local-notification-read-stop.json');
  const after = json('local-notification-read-after.json'), point = json('notification-read-checkpoint.json');
  assertNotificationReadRestart(before, stopped, after, point.fixture, report.runId);
  assert.equal(point.checkpoint.protectedRecordCount, 176);
  assert.match(bytes('collector-failure-excerpt.txt').toString(), /assert\(phases.has\(phase\)\)/);
  assert.equal(json('adb-pull-failure-cleanup.json').completed, true);
  assert.equal(json('disposable-store-restore.json').verified, true);
  assert.equal(json('host-observation.json').finalState, 'gone');
  for (const key of ['primaryCollectionAccepted', 'connectedStageAccepted', 'fullReplayAccepted', 'workflowPassed',
    'newMediaAccepted', 'physicalPhoneAccepted', 'pushDeliveryAccepted', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  assertEvidenceBundleChecksums(base); return report;
}
