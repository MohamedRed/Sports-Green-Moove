import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationReadRestartPhone(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json');
  const observer = json('checkpoints/session-results.json'), fixture = json('checkpoints/fixture.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'physical-android-notification-read-after-measured-force-stop-with-isolated-services');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.projectId, observer.projectId);
  assert.equal(report.checkedAt, record.checkedAt); assert.equal(report.checkedAt, '2026-10-23');
  assert.equal(report.testedAt, observer.testedAt); assert.equal(report.testedAt.slice(0, 10), report.checkedAt);
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.runId, observer.runId);
  assert.equal(report.backendSourceCommit, 'aba016d8da9949dea89372626e8d2bc9400cd9ac');
  assert.equal(report.appSourceCommit, '87082b10b44db59943089a21f82606f5a153be2b');
  assert.equal(report.selectedApk, 'sgm-notification-read-localhost-87082b10-20261023.apk');
  assert.equal(report.device, 'Google Pixel 9 Pro / Android 15');
  for (const key of ['sameDevice', 'manualNativeUiObserved', 'nativeProcessIdsMeasured', 'forceStopConfirmedInAndroidUi',
    'noProcessWhileStopped', 'relaunchedFromLauncher', 'sessionRestoredWithoutLogin', 'selectedReadRestored',
    'otherTwoNoticesRemainUnread', 'notificationProcessRestartPassed', 'preparationProcessChanged']) assert.equal(report[key], true, key);
  for (const key of ['installedBytesIndependentlyVerified', 'preparationRestartCauseKnown', 'productionTrackingRestartAccepted',
    'physicalTrackingAccepted', 'pushDeliveryAccepted', 'productionWrites', 'realMapsUsed', 'realPaymentsUsed',
    'iosAccepted', 'videoAccepted', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.equal(report.checkpointsPassed, 4); assert.equal(report.protectedRecordCount, 169);
  assert.deepEqual(report.profileTimestampExceptions, ['sgm-qa-parent', 'sgm-qa-driver']);
  assert.equal(observer.completed, true); assert.equal(observer.adminClientClosed, true);
  assert.equal(observer.scope, 'independent-notification-restart-checkpoints-not-ui-or-process-death-proof');
  assert.equal(observer.protectedRecordCount, 169); assert.deepEqual(observer.fixture, fixture);
  for (const key of ['nativeProcessIdsMeasured', 'physicalTrackingAccepted', 'pushDeliveryAccepted', 'productionWrites'])
    assert.equal(observer[key], false, key);
  const phases = ['initial', 'read', 'stopped', 'restarted'];
  assert.deepEqual(observer.checkpoints.map(row => row.phase), phases);
  const points = phases.map(phase => json('checkpoints/' + phase + '.json'));
  const initial = points[0], first = points[1], id = fixture.selectedNoticeId;
  assert.equal(new Set(Object.values(fixture)).size, 3);
  for (const value of Object.values(fixture)) assert.match(value, /^bookingDecision_[a-f0-9]{64}$/);
  const selected = state => state.documents.notifications.find(row => row.id === id)?.data;
  assert.equal(selected(initial.state).read, false); assert(!Object.hasOwn(selected(initial.state), 'readAt'));
  assert.equal(selected(first.state).read, true); const time = selected(first.state).readAt;
  assert(Number.isSafeInteger(time?._seconds) && time._seconds > 0);
  assert(Number.isInteger(time._nanoseconds) && time._nanoseconds >= 0 && time._nanoseconds < 1e9);
  const strip = state => ({ ...state, documents: { ...state.documents, notifications: state.documents.notifications.map(row => {
    if (row.id !== id) return row; const { read, readAt, ...data } = row.data; return { ...row, data };
  }) } });
  assert.deepEqual(strip(first.state), strip(initial.state));
  assert.equal(Object.values(initial.state.documents).reduce((n, rows) => n + rows.length, 0), 169);
  assert.equal(initial.result.selectedStillUnread, true); assert.equal(initial.result.allRecordsUnchanged, true);
  let recordedAt = 0;
  for (const [index, point] of points.entries()) {
    assert.equal(point.runId, report.runId); assert.equal(point.projectId, report.projectId);
    assert.equal(point.scope, 'independent-notification-record-checkpoint-not-phone-ui-or-process-proof');
    assert(Date.parse(point.recordedAt) > recordedAt); recordedAt = Date.parse(point.recordedAt);
    assert(recordedAt <= Date.parse(report.testedAt));
    assert.deepEqual(point.fixture, fixture); assert.deepEqual(point.result, observer.checkpoints[index].result);
    const own = point.state.documents.notifications.filter(row => row.data.userId === 'sgm-qa-parent');
    assert.equal(own.length, 3); assert.equal(own.filter(row => row.data.read).length, index ? 1 : 0);
    assert.equal(point.state.documents.notifications.find(row => row.id === fixture.controlNoticeId)?.data.read, false);
    if (!index) continue;
    assert.deepEqual(point.state, first.state);
    assert.equal(point.result.protectedRecordCount, 169);
    for (const key of ['allOtherRecordsUnchanged', 'allClaimsUnchanged', 'liveTripsUnchanged']) assert.equal(point.result[key], true);
    assert.equal(point.result.selectedReadAtMillis, time._seconds * 1000 + Math.floor(time._nanoseconds / 1e6));
    assert.deepEqual(point.result.inboxes, { parentConfirmedRead: true, otherNoticeUnread: true,
      driverInboxScoped: true, outsiderInboxScoped: true, foreignWritesDenied: true });
  }
  const measurements = Object.fromEntries(['preflight', 'before', 'stopped', 'after'].map(phase => [phase, json('process-' + phase + '.json')]));
  let measuredAt = 0;
  for (const [phase, measurement] of Object.entries(measurements)) {
    assert.equal(measurement.command, 'dumpsys meminfo be.sportgreenmoove.app.local');
    assert(Date.parse(measurement.recordedAt) > measuredAt); measuredAt = Date.parse(measurement.recordedAt);
    assert(measuredAt <= Date.parse(report.testedAt));
    if (phase === 'stopped') assert.match(measurement.visibleOutput, /^\d+ text No process found for: be\.sportgreenmoove\.app\.local$/);
    else {
      const match = measurement.visibleOutput.match(/\*\* MEMINFO in pid ([1-9]\d*) \[be\.sportgreenmoove\.app\.local\] \*\*/);
      assert(match); assert.equal(Number(match[1]), report.pids[phase]);
      if (phase !== 'preflight') assert(measurement.visibleOutput.includes('demo-sgm-local-qa'));
    }
  }
  assert.notEqual(report.pids.before, report.pids.after); assert.notEqual(report.pids.preflight, report.pids.before);
  assert(Date.parse(points[1].recordedAt) < Date.parse(measurements.before.recordedAt));
  assert(Date.parse(measurements.stopped.recordedAt) < Date.parse(points[2].recordedAt));
  assert(Date.parse(points[2].recordedAt) < Date.parse(measurements.after.recordedAt));
  const sourceFiles = ['scripts/qa/manual-notification-restart-phone-session.mjs', 'scripts/qa/local-notification-read-ui.mjs',
    'scripts/qa/notification-read-restart-evidence.mjs', 'functions/src/callables/notificationRead.ts'];
  assert.deepEqual(Object.keys(observer.sourceFiles).sort(), sourceFiles.sort());
  for (const [file, expected] of Object.entries(observer.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), expected, file);
  const cleanup = json('cleanup.json'), packageProbe = json('package-after-uninstall-attempt.json');
  for (const key of ['observerClosed', 'backendDirectoryRemoved', 'privateSessionRemoved', 'helperDirectoryRemoved',
    'ephemeralCredentialsCleared', 'phoneSignedOutObserved', 'phoneSessionStopped', 'dashboardObservedAfterStop',
    'uninstallAttemptedInAndroidUi', 'packageStillInstalledAfterAttempt']) assert.equal(cleanup[key], true, key);
  for (const key of ['appUninstallVerified', 'launcherAbsenceVerified', 'providerResetIndependentlyVerified',
    'clipboardRestorationVerified', 'personalDevicesChanged', 'globalPhoneSettingsChanged', 'administrationPolicyChanged'])
    assert.equal(cleanup[key], false, key);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.deepEqual(cleanup.endpoints, { host: '127.0.0.1', ports: [5001, 8080, 9000, 9099], closed: true });
  assert.equal(packageProbe.command, 'dumpsys package be.sportgreenmoove.app.local');
  assert.equal(packageProbe.visiblePackageMarker, 'Package [be.sportgreenmoove.app.local]');
  assert.match(packageProbe.visibleUserFragment, /^User 0:.*installed=true$/); assert.equal(packageProbe.uninstallVerified, false);
  assert.deepEqual(report.publishedCaptures, ['unread', 'read', 'restored-home', 'restarted-inbox']);
  const times = json('capture-times.json');
  for (const phase of [...report.publishedCaptures, 'force-stop-confirmation', 'stopped-app-info', 'signed-out', 'launcher-after-uninstall-attempt']) {
    assert(Number.isFinite(Date.parse(times[phase])));
    const size = imageSize(bytes('captures/' + phase + '.jpg'));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 240); assert.equal(size.height, 510);
  }
  assert(Date.parse(times.read) < Date.parse(measurements.before.recordedAt));
  assert(Date.parse(times['force-stop-confirmation']) < Date.parse(measurements.stopped.recordedAt));
  assert(Date.parse(times['restored-home']) > Date.parse(points[2].recordedAt));
  assert(Date.parse(times['restarted-inbox']) <= Date.parse(report.testedAt));
  assertEvidenceBundleChecksums(base); return report;
}
