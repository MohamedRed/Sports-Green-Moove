import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationSettingsPhone(root, flow) {
  assert.equal(flow.id, 'notification-settings'); assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone');
  const record = flow.notificationPermissionPhone, base = dirname(resolve(root, record.source));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const run = json('summary.json'), observer = json('phone/session-results.json');
  assert.equal(record.checkedAt, run.checkedAt); assert.equal(flow.checkedAt, run.checkedAt);
  assert.equal(run.scope, 'physical-android-notification-permission-with-isolated-account');
  assert.equal(run.sourceBaseCommit, 'd3a2f553ceea785139f4339ed845c633cb294fee');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.runId, observer.runId);
  assert.equal(run.sourceWasDirtyDuringPhoneTrial, true); assert.match(run.apkSha256, /^[a-f0-9]{64}$/);
  for (const key of ['actualPhonePermissionFlowPassed', 'appPermissionOnly', 'nativeTestApkBuilt']) assert.equal(run[key], true);
  for (const key of ['newNativeTestsExecuted', 'pushDeliveryAccepted', 'realNotificationSent', 'processSurvivalAccepted',
    'iosAccepted', 'productionWrites', 'realPaymentExercised', 'videoAccepted', 'releaseComplete']) assert.equal(run[key], false);
  assert.equal(run.accountIntegrityCheckpoints, 4); assert.equal(run.originalRecordsUnchanged, 158);
  assert.equal(run.unitsPassed, 504); assert.equal(run.notificationStateUnitsPassed, 7); assert.equal(run.nativeTestsAdded, 7);
  assert.equal(observer.completed, true); assert.equal(observer.adminClientClosed, true); assert.equal(observer.originalRecordCount, 158);
  const phases = ['initial', 'first-return', 'second-return', 'restored'];
  assert.deepEqual(observer.checkpoints.map(row => row.phase), phases);
  for (const phase of phases) {
    const row = json('phone/' + phase + '.json'); assert(observer.checkpoints.some(point => point.phase === phase));
    assert.equal(row.recordCount, 158); assert.equal(row.originalRecordsUnchanged, true); assert.equal(row.originalClaimsUnchanged, true);
    assert.equal(row.osPermissionProvenByThisObserver, false); assert.equal(row.pushDeliveryAccepted, false);
  }
  for (const [file, hash] of Object.entries(observer.sourceFiles))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), hash, file);
  const observation = json('observations.json'); assert.equal(observation.steps.length, 9);
  assert.equal(observation.manualAppRestartRequested, false); assert.equal(observation.processIdsMeasured, false);
  const cleanup = json('cleanup.json');
  for (const key of ['credentialRemoved', 'helperDirectoryRemoved', 'phoneSignedOut', 'appUninstallAcknowledged', 'launcherAbsenceObserved', 'phoneSessionStopped']) assert.equal(cleanup[key], true);
  for (const key of ['notificationAllowedInitially', 'notificationAllowedFinally', 'notificationFlagsMeasured', 'globalPhoneSettingsChanged', 'administrationPolicyChanged', 'chromeRestarted']) assert.equal(cleanup[key], false);
  assert.deepEqual(cleanup.portsClosed, [5001,8080,9000,9099,45690,45691]);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.match(bytes('red/contract-transcript.txt').toString(), /# fail 1/);
  assert.match(bytes('red/ui/ProfileScreen.kt').toString(), /"Notifications", "Activées", ProfileAction.Options/);
  assert.match(bytes('red/ui/OptionsScreen.kt').toString(), /"Notifications", "Activées"/);
  const parser = new XMLParser({ignoreAttributes: false});
  const units = readdirSync(resolve(base, 'validation/unit')).filter(file => file.endsWith('.xml')).map(file => parser.parse(bytes('validation/unit/' + file)).testsuite);
  assert.equal(units.reduce((n, row) => n + Number(row['@_tests']), 0), 504);
  assert(units.every(row => ['@_failures', '@_errors', '@_skipped'].every(key => row[key] === '0')));
  assert.equal(units.find(row => row['@_name'].endsWith('NotificationSettingsStateTest'))['@_tests'], '7');
  assert.match(bytes('validation/android-build.txt').toString(), /BUILD SUCCESSFUL/);
  assert.match(bytes('validation/local-apk-build.txt').toString(), /BUILD SUCCESSFUL/);
  assert.match(bytes('validation/root-tests.txt').toString(), /EADDRINUSE/);
  assert.match(bytes('validation/root-tests-after-cleanup.txt').toString(), /# pass 1764\r?\n# fail 0/);
  assert.deepEqual(flow.images.map(image => image.file), run.publishedCaptures.map(name => 'notification-phone-' + name));
  for (const name of ['profile-blocked', 'os-blocked', 'os-allowed', 'profile-allowed', 'options-allowed', 'os-restored', 'options-blocked', 'profile-restored']) {
    const size = imageSize(bytes('captures/' + name + '.jpg')), compact = name.startsWith('options-');
    assert.equal(size.type, 'jpg'); assert.equal(size.width, compact ? 230 : 254); assert.equal(size.height, compact ? 132 : 559);
  }
  assertEvidenceBundleChecksums(base);
  return run;
}
