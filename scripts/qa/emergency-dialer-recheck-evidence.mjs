import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateEmergencyDialerRecheck(root, record, readFile = readFileSync) {
  const base = dirname(resolve(root, record.source)), read = file => readFile(resolve(base, file));
  const run = JSON.parse(read('results.json'));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(run.checkedAt, record.checkedAt); assert.equal(run.checkedAt, '2026-10-23');
  assert.equal(run.scope, 'physical-system-dialer-prerequisite-blocked-before-app-flow');
  assert.equal(run.result, 'blocked');
  assert.equal(run.sourceCommit, 'a2f273fb45d0f5f8bd882f9f7a3ebeb49e5513a1');
  assert.equal(run.appSourceCommit, '87082b10b44db59943089a21f82606f5a153be2b');
  assert.equal(run.selectedApk, 'sgm-notification-read-localhost-87082b10-20261023.apk');
  assert.equal(run.apkSha256, '03cfdc02c28910e88ef57a673e397509232bfd8c828b70642abdcfcf157b45c4');
  assert.deepEqual(run.device, {model: 'Google Pixel 10', os: 'Android 16', selection: 'No SIM'});
  assert.equal(run.observationMethod, 'operator-observed-provider-browser-stream-not-native-package-diagnostics');
  assert.equal(run.phoneIconAttempts, 2);
  for (const flag of ['appDrawerGestureResponsive', 'returnedHomeAfterEachPhoneAttempt',
    'diagnosticPanelUnavailable', 'capturesReviewed', 'appInstalled']) assert.equal(run[flag], true);
  for (const flag of ['installedBytesIndependentlyVerified', 'adbDiagnosticsCollected', 'appSignInPerformed',
    'localBackendStarted', 'privateTunnelStarted', 'dialerHandoffAttemptedFromApp', 'dialerHandoffVerified',
    'rootCauseConfirmed', 'realCallsPlaced', 'contactDataEntered', 'devicePolicyChanged', 'permissionsChanged',
    'subscriptionChanged', 'chromeRestarted', 'productionWrites', 'videoRecorded', 'storeReviewAccepted',
    'releaseEvidenceAccepted']) assert.equal(run[flag], false);
  assert.deepEqual(run.supportFollowup, {status: 'not-checked-connection-reauthentication-required', responseReceived: null});
  assert.deepEqual(run.publishedCaptures, []);
  assert.equal(run.captureMethod, 'original-unscaled-device-only-browser-stream-rectangles');
  assert.deepEqual(run.captures, ['home.jpg', 'after-phone.jpg', 'app-drawer.jpg', 'after-drawer-phone.jpg']);
  for (const file of run.captures) {
    const size = imageSize(read(file)); assert.equal(size.type, 'jpg');
    assert.equal(size.width, 250); assert.equal(size.height, 557);
  }
  assert.deepEqual(run.cleanup, {providerUiUninstall: 'Succesfully uninstalled your app(s)!',
    packageInventoryVerified: false, phoneSessionStopped: true, uploadedAppsDashboardVisible: true,
    endpoints: {host: '127.0.0.1', ports: [5001, 8080, 9000, 9099], closed: true}});
  assertEvidenceBundleChecksums(base);
  return run;
}
