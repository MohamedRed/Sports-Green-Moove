import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateSystemPhonePrerequisite(root, record) {
  const base = dirname(resolve(root, record.source)), json = file => JSON.parse(readFileSync(resolve(base, file)));
  const report = json('summary.json'), dialer = json('dialer-package-observation.json'), cleanup = json('package-cleanup-observation.json');
  assert.equal(record.checkedAt, report.checkedAt); assert.equal(report.observedAt.slice(0, 10), record.checkedAt);
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'system-phone-prerequisite-not-app-emergency-flow');
  assert.deepEqual(report.device, { manufacturer: 'Samsung', model: 'Galaxy S24', android: '14.0', sim: 'none' });
  assert.equal(report.sourceCommit, '13a5b1e27e63133c6e7dcebf53a75f25a93e852f');
  assert.equal(report.appSourceCommit, '87082b10b44db59943089a21f82606f5a153be2b');
  assert.equal(report.selectedApk, 'sgm-notification-read-localhost-87082b10-20261023.apk');
  assert.deepEqual(report.phoneLaunches, [{ entry: 'system-home-shortcut', result: 'returned-to-home' },
    { entry: 'labelled-app-drawer-phone', result: 'returned-to-home' }]);
  for (const key of ['installedApkBytesIndependentlyVerified', 'accountSignedIn', 'privateTunnelStarted', 'localBackendStarted',
    'productionWrites', 'phoneNumberEntered', 'callPlaced', 'dialerHandoffAccepted', 'rootCauseConfirmed', 'policyChanged',
    'permissionsChanged', 'subscriptionChanged', 'browserRestarted', 'releaseComplete']) assert.equal(report[key], false, key);
  for (const key of ['appLoginScreenObserved', 'packageAbsenceVerified', 'phoneSessionStopped', 'providerUninstallAcknowledged'])
    assert.equal(report[key], true, key);
  assert.deepEqual(report.publicGalleryAssetsAdded, []);
  assert.equal(dialer.command, 'dumpsys package com.samsung.android.dialer'); assert.equal(dialer.versionName, '15.1.78');
  assert.equal(dialer.actionDialFilterPresent, true); assert.equal(dialer.telSchemePresent, true);
  assert.match(dialer.userStateExcerpt, /installed=true hidden=false suspended=false/);
  assert.match(dialer.userStateExcerpt, /stopped=true notLaunched=false enabled=0/);
  assert.equal(dialer.rootCauseConfirmed, false); assert.equal(dialer.callPlaced, false);
  assert.equal(cleanup.command, 'dumpsys package be.sportgreenmoove.app.local'); assert.equal(cleanup.packageAbsent, true);
  assert.equal(cleanup.outputExcerpt, 'Unable to find package: be.sportgreenmoove.app.local');
  assert.equal(cleanup.acknowledgementPresentInPackageSnapshot, false);
  assert.deepEqual(report.endpoints, { host: '127.0.0.1', ports: [9099,8080,9000,5001], closed: true });
  assert.equal(report.captures.length, 5);
  for (const name of report.captures) {
    assert.match(name, /^0[1-5]-[a-z-]+\.jpg$/);
    const size = imageSize(readFileSync(resolve(base, name)));
    assert.equal(size.type, 'jpg'); assert.equal(size.width, 249); assert.equal(size.height, 530);
  }
  assertEvidenceBundleChecksums(base); return report;
}
