import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { imageSize } from 'image-size';
import { assertNotificationReadRestart, verifyNotificationReadRecords } from './notification-read-restart-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationNativeRecovery(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json'), run = json('native-run.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'completed-connected-notification-native-restart-with-later-driver-case-failure-not-full-replay');
  assert.equal(run.databaseId, 40019171668); assert.equal(run.headSha, '412f22f7f00fd836f394b06cf5804ed196bc02f0');
  assert.equal(report.sourceCommit, run.headSha); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(job => job.databaseId === 120638942277).conclusion, 'failure');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, 12529898848); assert.equal(artifact.workflow_run.head_sha, run.headSha);
  const ordinary = json('ordinary-results.json');
  assert.equal(ordinary.passed, 158); assert.equal(ordinary.skipped, 52); assert.equal(ordinary.failed, 0);
  const components = ordinary.cases.filter(row => row.className.endsWith('.NotificationReadFlowTest'));
  assert.equal(components.length, 4); assert(components.every(row => row.status === 'passed'));
  const stage = json('notification-read-ui-stage.json'), records = json('notification-read-records.json');
  assert.equal(stage.completed, true); assert.equal(stage.runId, report.runId); assert.equal(stage.nativeCaseCount, 2);
  assertNotificationReadRestart(stage.native.before, stage.native.stopped, stage.native.after, stage.fixture, report.runId);
  assert.equal(json('adb-pull-notification-read-restart.json').completed, true);
  for (const phase of ['readSelectedNotificationAndSwitchAccounts', 'reopenReadNotificationAfterProcessDeath'])
    assertInstrumentationPassed(bytes('LocalNotificationReadFlowTest#' + phase + '-instrumentation.txt').toString(), 1);
  const after = structuredClone(records.afterRead), notice = after.documents.notifications.find(row => row.id === stage.fixture.selectedNoticeId);
  const time = notice.data.readAt; assert.equal(time._nanoseconds % 1e6, 0);
  notice.data.readAt = Timestamp.fromMillis(time._seconds * 1000 + time._nanoseconds / 1e6);
  const verified = verifyNotificationReadRecords(records.baseline, after, stage.fixture.selectedNoticeId);
  assert.equal(verified.protectedRecordCount, 176); assert.deepEqual(verified, stage.checkpoint); assert.deepEqual(verified, stage.persisted);
  assert.deepEqual(records.afterRead, records.afterRestart);
  for (const value of Object.values(stage.inboxes)) assert.equal(value, true);
  for (const file of stage.captureFiles) {
    assert(!file.includes('/') && file.startsWith('local-notification-read-'));
    const size = imageSize(bytes(file)); assert.equal(size.type, 'png'); assert(size.width > 0 && size.height > 0);
  }
  assert.equal(stage.captureFiles.length, 5);
  const transcript = bytes('LocalAppFlowTest-LocalDriverFlowTest-LocalLandscapeLoginTest-LocalUiRegressionTest-SearchSessionFlowTest-SearchCriteriaFlowTest-instrumentation.txt').toString();
  assert.match(transcript, /LocalDriverFlowTest\.driverApprovesPendingBookingAndSignsOut\(LocalDriverFlowTest.kt:51\)/);
  assert.match(transcript, /Tests run: 9,\s+Failures: 1/);
  assert.equal(json('disposable-store-restore.json').verified, true); assert.equal(json('host-observation.json').finalState, 'gone');
  assert.equal(report.notificationStageAccepted, true); assert.equal(report.primaryCollectionAccepted, true);
  for (const key of ['fullReplayAccepted', 'workflowPassed', 'driverApprovalRegressionCorrected', 'exactPostFailureApprovalStateRetained',
    'physicalPhoneAccepted', 'pushDeliveryAccepted', 'newMediaPublished', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  assertEvidenceBundleChecksums(base); return report;
}
