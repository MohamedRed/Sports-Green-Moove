import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationReadPhone(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json'), observer = json('phone/session-results.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.runId, observer.runId); assert.equal(observer.completed, true); assert.equal(observer.adminClientClosed, true);
  assert.equal(report.scope, 'physical-android-notification-read-and-sequential-account-switch-with-isolated-backend');
  assert.equal(report.appSourceCommit, '87082b10b44db59943089a21f82606f5a153be2b');
  assert.equal(report.observerSourceWasUncommitted, true);
  const apk = json('apk-identity.json');
  assert.equal(apk.appId, 'be.sportgreenmoove.app.local'); assert.equal(apk.emulatorHost, 'localhost');
  assert.equal(apk.sourceCommit, report.appSourceCommit); assert.equal(apk.controllerWasUncommitted, true);
  assert.equal(apk.isolatedLocalConfigurationVerified, true); assert.equal(apk.mapsApprovalUsed, false);
  assert.equal(apk.sha256, '03cfdc02c28910e88ef57a673e397509232bfd8c828b70642abdcfcf157b45c4');
  for (const key of ['actualPhoneReadPassed', 'actualAccountSwitchPassed', 'parentReturnPassed']) assert.equal(report[key], true);
  for (const key of ['processDeathAccepted', 'nativeProcessIdsMeasured', 'pushDeliveryAccepted', 'physicalTrackingAccepted',
    'productionWrites', 'realMapsUsed', 'realPaymentsUsed', 'iosAccepted', 'videoAccepted', 'releaseComplete']) assert.equal(report[key], false);
  assert.equal(report.checkpointsPassed, 4); assert.equal(report.protectedRecordCount, 167);
  const phases = ['initial', 'read', 'driver', 'reopened'];
  assert.deepEqual(observer.checkpoints.map(row => row.phase), phases);
  for (const key of ['nativeProcessIdsMeasured', 'physicalTrackingAccepted', 'pushDeliveryAccepted', 'productionWrites']) assert.equal(observer[key], false);
  const points = phases.map(phase => json('phone/' + phase + '.json'));
  const initial = points[0], first = points[1], id = initial.fixture.selectedNoticeId;
  assert.equal(initial.result.selectedStillUnread, true); assert.equal(initial.result.allRecordsUnchanged, true);
  const selected = state => state.documents.notifications.find(row => row.id === id).data;
  assert.equal(selected(initial.state).read, false); assert(!Object.hasOwn(selected(initial.state), 'readAt'));
  assert.equal(selected(first.state).read, true);
  const time = selected(first.state).readAt;
  assert(Number.isSafeInteger(time._seconds) && time._seconds > 0);
  assert(Number.isInteger(time._nanoseconds) && time._nanoseconds >= 0 && time._nanoseconds < 1e9);
  const strip = state => ({...state, documents: {...state.documents, notifications: state.documents.notifications.map(row => {
    if (row.id !== id) return row; const {read, readAt, ...data} = row.data; return {...row, data};
  })}});
  assert.deepEqual(strip(first.state), strip(initial.state));
  assert.equal(Object.values(initial.state.documents).reduce((n, rows) => n + rows.length, 0), 167);
  for (const [index, point] of points.entries()) {
    assert.equal(point.runId, report.runId); assert.equal(point.projectId, report.projectId);
    assert.deepEqual(point.fixture, initial.fixture); assert.deepEqual(point.result, observer.checkpoints[index].result);
    if (!index) continue;
    assert.deepEqual(point.state, first.state);
    for (const key of ['allOtherRecordsUnchanged', 'allClaimsUnchanged', 'liveTripsUnchanged']) assert.equal(point.result[key], true);
    assert.equal(point.result.selectedReadAtMillis, time._seconds * 1000 + Math.floor(time._nanoseconds / 1e6));
    for (const value of Object.values(point.result.inboxes)) assert.equal(value, true);
  }
  for (const [file, expected] of Object.entries(observer.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file + '.txt')).digest('hex'), expected);
  assert.deepEqual(report.captures, ['unread', 'read', 'driver', 'parent-return']);
  for (const name of report.captures) {
    const size = imageSize(bytes('captures/' + name + '.jpg'));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 254); assert.equal(size.height, 559);
  }
  const cleanup = json('cleanup.json');
  for (const key of ['credentialRemoved', 'helperDirectoryRemoved', 'observerClosed', 'phoneSessionStopped', 'dashboardObservedAfterStop']) assert.equal(cleanup[key], true);
  for (const key of ['finalPhoneSignOutVerified', 'appUninstallVerified', 'launcherAbsenceVerified', 'chromeRestarted',
    'personalDevicesChanged', 'globalPhoneSettingsChanged', 'administrationPolicyChanged']) assert.equal(cleanup[key], false);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.deepEqual(cleanup.portsClosed, [5001,8080,9000,9099,45690,45691]);
  assertEvidenceBundleChecksums(base); return report;
}
