import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const [input, destination] = process.argv.slice(2);
assert(input?.startsWith('/') && destination?.startsWith('/') && !existsSync(destination));
const endpoints = await assertLocalEndpointsClosed([5001, 8080, 9000, 9099]);
const captures = ['home.jpg', 'after-phone.jpg', 'app-drawer.jpg', 'after-drawer-phone.jpg'];
for (const file of captures) assert(existsSync(resolve(input, file)));
assert(existsSync(resolve(input, 'README.md')));
mkdirSync(destination, {recursive: true});
for (const file of captures) copyFileSync(resolve(input, file), resolve(destination, file));
const write = (file, data) => writeFileSync(resolve(destination, file), JSON.stringify(data, null, 2) + '\n');
write('results.json', {
  scope: 'physical-system-dialer-prerequisite-blocked-before-app-flow', checkedAt: '2026-10-23',
  sourceCommit: 'a2f273fb45d0f5f8bd882f9f7a3ebeb49e5513a1',
  appSourceCommit: '87082b10b44db59943089a21f82606f5a153be2b',
  selectedApk: 'sgm-notification-read-localhost-87082b10-20261023.apk',
  apkSha256: '03cfdc02c28910e88ef57a673e397509232bfd8c828b70642abdcfcf157b45c4',
  installedBytesIndependentlyVerified: false,
  device: {model: 'Google Pixel 10', os: 'Android 16', selection: 'No SIM'}, result: 'blocked',
  observationMethod: 'operator-observed-provider-browser-stream-not-native-package-diagnostics',
  phoneIconAttempts: 2, appDrawerGestureResponsive: true, returnedHomeAfterEachPhoneAttempt: true,
  diagnosticPanelUnavailable: true, adbDiagnosticsCollected: false, capturesReviewed: true,
  captureMethod: 'original-unscaled-device-only-browser-stream-rectangles', captures, publishedCaptures: [],
  appInstalled: true, appSignInPerformed: false, localBackendStarted: false, privateTunnelStarted: false,
  dialerHandoffAttemptedFromApp: false, dialerHandoffVerified: false, rootCauseConfirmed: false,
  realCallsPlaced: false, contactDataEntered: false, devicePolicyChanged: false, permissionsChanged: false,
  subscriptionChanged: false, chromeRestarted: false, productionWrites: false, videoRecorded: false,
  storeReviewAccepted: false, releaseEvidenceAccepted: false,
  supportFollowup: {status: 'not-checked-connection-reauthentication-required', responseReceived: null},
  cleanup: {providerUiUninstall: 'Succesfully uninstalled your app(s)!', packageInventoryVerified: false,
    phoneSessionStopped: true, uploadedAppsDashboardVisible: true, endpoints},
});
const files = [...captures, 'results.json'];
copyFileSync(resolve(input, 'README.md'), resolve(destination, 'README.md'));
write('artifact-sha256.json', Object.fromEntries(files.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex')])));
console.log('Retained blocked system-dialer prerequisite; no accepted app media or release evidence.');
