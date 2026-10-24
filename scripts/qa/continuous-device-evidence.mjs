import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const setupScope = 'single-case-continuous-installation-guard-not-flow-proof';
const reportScopes = {
  'parent-search-booking': 'local-parent-search-two-seat-booking-not-physical-or-payment',
  'emergency-identity': 'local-recreated-child-contact-ui-not-own-child-account',
  'ride-observation': 'local-ride-live-sdk-not-physical-gps',
  'native-startup': 'local-fused-mock-startup-not-physical-gps',
  'remote-ride-stop': 'local-remote-completion-service-stop-not-physical-background-gps',
  'session-restoration': 'local-session-restoration-ui-not-physical-network-loss',
  'session-disconnect': 'local-session-disconnect-process-restart-not-physical-network-loss',
};
const packages = ['be.sportgreenmoove.app.local', 'be.sportgreenmoove.app.local.test'];
const backgroundModes = ['allow', 'ignore', 'deny', 'default', 'foreground'];

function record(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function bytes(value, label) {
  assert(typeof value === 'string' || value instanceof Uint8Array, `${label} must contain the original bytes`);
  return Buffer.from(value);
}

function validateHashes(hashes) {
  record(hashes, 'apkHashes');
  assert.deepEqual(Object.keys(hashes).sort(), [...packages].sort(), 'Exactly the two local APKs are required');
  for (const name of packages) {
    assert.equal(typeof hashes[name], 'string');
    assert.equal(hashes[name].length, 64);
    assert.match(hashes[name], /^[a-f0-9]{64}$/, `${name} must have a SHA-256 digest`);
  }
}

function validateMaps(maps) {
  record(maps, 'mapsRuntime');
  assert.equal(maps.playStoreEnabled, true);
  assert.equal(maps.playServicesEnabled, true);
  assert.equal(typeof maps.playServicesVersion, 'string');
  assert.equal(maps.playServicesVersion.trim(), maps.playServicesVersion);
  assert.match(maps.playServicesVersion, /^\d+\.\d+\.\d+$/);
  const version = maps.playServicesVersion.split('.').map(Number);
  assert(version.every(Number.isSafeInteger));
  const [major, minor, patch] = version;
  // Match androidMapsPrerequisites' minimum, not a lexical version comparison.
  assert(major > 21 || (major === 21 && (minor > 39 || (minor === 39 && patch >= 14))),
    'Maps rendering requires Play services 21.39.14 or later');
}

// Validate retained observations only; instrumentation and CI provenance belong to the caller.
export function validateContinuousDeviceEvidence({ setup, restored, report, setupBytes, claimed }) {
  record(setup, 'setup'); record(restored, 'restored'); record(report, 'report');
  const raw = bytes(setupBytes, 'setupBytes');
  assert.deepEqual(JSON.parse(raw.toString('utf8')), setup, 'setup must match its retained raw receipt');
  assert.equal(setup.scope, setupScope);
  assert(Object.hasOwn(reportScopes, setup.case), 'An exact focused case is required');
  assert.equal(setup.serial, 'emulator-5554', 'The retained Native CI receipts use emulator-5554');
  validateMaps(setup.mapsRuntime);
  validateHashes(setup.apkHashes);
  assert.deepEqual(setup.installAdmin, {
    packageName: 'be.sportgreenmoove.qa.installguard', originalBlocked: false,
    policyReady: true, noAccounts: true,
  });
  record(setup.originalBackground, 'originalBackground');
  assert.deepEqual(Object.keys(setup.originalBackground).sort(), ['RUN_ANY_IN_BACKGROUND', 'RUN_IN_BACKGROUND']);
  for (const mode of Object.values(setup.originalBackground)) assert(backgroundModes.includes(mode));
  assert.equal(typeof setup.originalStoreStopped, 'boolean');
  assert.equal(typeof setup.storeStoppedAfterLock, 'boolean');

  assert.equal(restored.scope, 'single-case-device-restoration-not-flow-proof');
  assert.equal(restored.case, setup.case);
  assert.equal(restored.verified, true);
  assert.equal(restored.restored, true);
  assert.equal(restored.observed?.continuousGuardVerified, true, 'Post-run continuous guard is required');
  assert.equal(typeof restored.observed.storeStopped, 'boolean');
  assert.deepEqual(restored.restoration, {
    localPackagesRemoved: true, background: true, stopped: true, launcher: true,
    installAdmin: { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true },
  }, 'Every independent cleanup step and administrator removal must succeed');

  assert.equal(report.scope, reportScopes[setup.case]);
  assert.equal(report.primaryEvidencePhase, setup.case);
  assert.equal(report.localPackagesRemoved, true);
  const preparation = report.apkPreparation;
  record(preparation, 'report.apkPreparation');
  assert.equal(preparation.method, setupScope);
  assert.equal(preparation.case, setup.case);
  assert.equal(preparation.installationsRemainedBlocked, true, 'Pre-run continuous guard is required');
  assert.equal(preparation.receiptSha256, createHash('sha256').update(raw).digest('hex'),
    'Preparation must reference the exact raw setup bytes');
  validateHashes(preparation.apkHashes);
  assert.deepEqual(preparation.apkHashes, setup.apkHashes);
  assert(bytes(claimed, 'claimed').equals(Buffer.from(`${setup.case}\n`)), 'Claim must be exactly case plus newline');

  return { scope: 'continuous-device-policy-only-not-flow-or-release-proof', status: 'passed',
    case: setup.case, serial: setup.serial };
}
