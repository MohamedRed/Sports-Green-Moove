import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateContinuousDeviceEvidence } from '../scripts/qa/continuous-device-evidence.mjs';

const scopes = {
  'emergency-identity': 'local-recreated-child-contact-ui-not-own-child-account',
  'ride-observation': 'local-ride-live-sdk-not-physical-gps',
  'native-startup': 'local-fused-mock-startup-not-physical-gps',
  'remote-ride-stop': 'local-remote-completion-service-stop-not-physical-background-gps',
  'session-restoration': 'local-session-restoration-ui-not-physical-network-loss',
  'session-disconnect': 'local-session-disconnect-process-restart-not-physical-network-loss',
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const app = 'be.sportgreenmoove.app.local', runner = `${app}.test`;

function fixture(caseName = 'native-startup') {
  const setup = {
    scope: 'single-case-continuous-installation-guard-not-flow-proof', case: caseName, serial: 'emulator-5554',
    mapsRuntime: { playStoreEnabled: true, playServicesEnabled: true, playServicesVersion: '24.23.35' },
    originalBackground: { RUN_IN_BACKGROUND: 'allow', RUN_ANY_IN_BACKGROUND: 'allow' },
    originalStoreStopped: false, storeStoppedAfterLock: false,
    apkHashes: { [app]: digest(`${caseName}:app`), [runner]: digest(`${caseName}:runner`) },
    installAdmin: { packageName: 'be.sportgreenmoove.qa.installguard', originalBlocked: false,
      policyReady: true, noAccounts: true },
  };
  const restored = {
    scope: 'single-case-device-restoration-not-flow-proof', case: caseName,
    observed: { continuousGuardVerified: true, storeStopped: false }, restored: true, verified: true,
    restoration: { localPackagesRemoved: true, background: true, stopped: true, launcher: true,
      installAdmin: { authorizationRemoved: true, componentRemoved: true, originalPolicyRestored: true } },
  };
  const report = { scope: scopes[caseName], primaryEvidencePhase: caseName, localPackagesRemoved: true,
    apkPreparation: { method: setup.scope, case: caseName, receiptSha256: '',
      apkHashes: { ...setup.apkHashes }, installationsRemainedBlocked: true } };
  const f = { setup, restored, report, claimed: `${caseName}\n` };
  rebind(f);
  return f;
}

function rebind(f) {
  f.setupBytes = Buffer.from(`${JSON.stringify(f.setup)}\n`);
  f.report.apkPreparation.receiptSha256 = digest(f.setupBytes);
}

function setPath(target, path, value) {
  const keys = path.split('.'), key = keys.pop();
  const parent = keys.reduce((object, name) => object[name], target);
  if (value === undefined) delete parent[key];
  else parent[key] = value;
}

test('all focused synthetic receipt shapes validate without accepting user flows', () => {
  for (const caseName of Object.keys(scopes)) {
    const f = fixture(caseName), before = { ...structuredClone(f), setupBytes: Buffer.from(f.setupBytes) };
    assert.deepEqual(validateContinuousDeviceEvidence(f), {
      scope: 'continuous-device-policy-only-not-flow-or-release-proof', status: 'passed',
      case: caseName, serial: 'emulator-5554',
    });
    assert.deepEqual(f, before, 'Validation must not mutate its inputs');
  }
});

test('stopped observations may be false only with both continuous guard attestations', () => {
  for (const pre of [false, true]) for (const post of [false, true]) {
    const f = fixture();
    f.setup.storeStoppedAfterLock = pre; f.restored.observed.storeStopped = post; rebind(f);
    validateContinuousDeviceEvidence(f);
    for (const path of ['report.apkPreparation.installationsRemainedBlocked', 'restored.observed.continuousGuardVerified']) {
      const bad = structuredClone(f); setPath(bad, path, false);
      assert.throws(() => validateContinuousDeviceEvidence(bad), path);
    }
  }
});

test('raw setup identity and exact bytes are bound, including whitespace', () => {
  const altered = fixture(); altered.setup.originalStoreStopped = true;
  assert.throws(() => validateContinuousDeviceEvidence(altered), /raw receipt/);
  const reformatted = fixture(); reformatted.setupBytes = Buffer.from(JSON.stringify(reformatted.setup, null, 2));
  assert.throws(() => validateContinuousDeviceEvidence(reformatted), /raw setup bytes/);
  const changedBytes = fixture(); changedBytes.setupBytes = Buffer.concat([changedBytes.setupBytes, Buffer.from('\n')]);
  assert.throws(() => validateContinuousDeviceEvidence(changedBytes), /raw setup bytes/);
  const malformed = fixture(); malformed.setupBytes = Buffer.from('{');
  assert.throws(() => validateContinuousDeviceEvidence(malformed), SyntaxError);
  const badHash = fixture(); badHash.report.apkPreparation.receiptSha256 = '0'.repeat(64);
  assert.throws(() => validateContinuousDeviceEvidence(badHash));
});

test('scope, case, phase, serial and preparation method must agree exactly', () => {
  const mutations = [
    ['setup.scope', 'disposable-emulator-without-home-navigation'], ['setup.case', 'other'],
    ['setup.case', 'toString'], ['setup.serial', 'emulator-5556'], ['setup.serial', 'physical-phone'],
    ['setup.installAdmin.packageName', 'foreign.admin'], ['setup.installAdmin.originalBlocked', true],
    ['restored.scope', 'failed-single-case-device-preparation-not-flow-proof'],
    ['restored.case', 'ride-observation'], ['report.scope', scopes['ride-observation']],
    ['report.primaryEvidencePhase', 'ride-observation'], ['report.apkPreparation.case', 'ride-observation'],
    ['report.apkPreparation.method', 'restricted-store-background'],
  ];
  for (const [path, value] of mutations) {
    const f = fixture(); setPath(f, path, value); rebind(f);
    assert.throws(() => validateContinuousDeviceEvidence(f), path);
  }
  const f = fixture(), other = fixture('ride-observation');
  f.report = other.report;
  assert.throws(() => validateContinuousDeviceEvidence(f));
});

test('every readiness, guard and independent cleanup flag is strictly required', () => {
  const paths = [
    'setup.installAdmin.policyReady', 'setup.installAdmin.noAccounts',
    'setup.mapsRuntime.playStoreEnabled', 'setup.mapsRuntime.playServicesEnabled',
    'restored.verified', 'restored.restored', 'restored.observed.continuousGuardVerified',
    'restored.restoration.localPackagesRemoved', 'restored.restoration.background',
    'restored.restoration.stopped', 'restored.restoration.launcher',
    'restored.restoration.installAdmin.authorizationRemoved', 'restored.restoration.installAdmin.componentRemoved',
    'restored.restoration.installAdmin.originalPolicyRestored',
    'report.apkPreparation.installationsRemainedBlocked', 'report.localPackagesRemoved',
  ];
  for (const path of paths) for (const value of [false, null, undefined, 'true', 1, {}]) {
    const f = fixture(); setPath(f, path, value); rebind(f);
    assert.throws(() => validateContinuousDeviceEvidence(f), `${path}=${JSON.stringify(value)}`);
  }
  const f = fixture(); f.restored.restoration.extraCleanup = false;
  assert.throws(() => validateContinuousDeviceEvidence(f));
});

test('hashes require exactly two named APKs with matching lowercase SHA-256 digests', () => {
  for (const key of ['setup', 'report']) for (const change of [
    (h) => { delete h[runner]; }, (h) => { h['foreign.apk'] = digest('foreign'); },
    (h) => { h[app] = 'A'.repeat(64); }, (h) => { h[runner] = '0'.repeat(63); },
    (h) => { h[app] = 'z'.repeat(64); }, (h) => { h[app] = 42; },
    (h) => { h[app] += '\n'; },
    (h) => { h[app] = digest('different-app'); },
  ]) {
    const f = fixture(); change(key === 'setup' ? f.setup.apkHashes : f.report.apkPreparation.apkHashes); rebind(f);
    assert.throws(() => validateContinuousDeviceEvidence(f), key);
  }
  const f = fixture(); f.report.apkPreparation.apkHashes = { [app]: f.setup.apkHashes[runner], [runner]: f.setup.apkHashes[app] };
  assert.throws(() => validateContinuousDeviceEvidence(f));
});

test('claims must contain only the matching case and one LF, as text or raw bytes', () => {
  const f = fixture(); f.claimed = Buffer.from(f.claimed); validateContinuousDeviceEvidence(f);
  for (const claimed of ['', 'native-startup', 'native-startup\r\n', 'native-startup\n\n',
    ' native-startup\n', 'ride-observation\n', '\ufeffnative-startup\n', null, {}]) {
    assert.throws(() => validateContinuousDeviceEvidence({ ...fixture(), claimed }));
  }
});

test('Maps runtime uses semantic minimum 21.39.14 and refuses blank or malformed versions', () => {
  for (const version of ['21.39.14', '21.39.15', '21.40.0', '22.0.0', '24.23.35', '100.0.0']) {
    const f = fixture(); f.setup.mapsRuntime.playServicesVersion = version; rebind(f);
    validateContinuousDeviceEvidence(f);
  }
  for (const version of ['', ' ', '21.39.13', '21.9.99', '20.99.99', '24.23', '24.23.35 beta', '24.23.35\n', 24, null,
    '99999999999999999999.0.0']) {
    const f = fixture(); f.setup.mapsRuntime.playServicesVersion = version; rebind(f);
    assert.throws(() => validateContinuousDeviceEvidence(f), String(version));
  }
});

test('original state and observed stopped values must be explicit, never inferred', () => {
  for (const path of ['setup.originalStoreStopped', 'setup.storeStoppedAfterLock', 'restored.observed.storeStopped']) {
    for (const value of [null, undefined, 'false', 0]) {
      const f = fixture(); setPath(f, path, value); rebind(f);
      assert.throws(() => validateContinuousDeviceEvidence(f), path);
    }
  }
  for (const originalBackground of [{}, { RUN_IN_BACKGROUND: 'unknown', RUN_ANY_IN_BACKGROUND: 'allow' },
    { RUN_IN_BACKGROUND: 'allow', RUN_ANY_IN_BACKGROUND: 'allow', extra: 'allow' }]) {
    const f = fixture(); f.setup.originalBackground = originalBackground; rebind(f);
    assert.throws(() => validateContinuousDeviceEvidence(f));
  }
});

test('missing or malformed evidence fails closed', () => {
  for (const key of ['setup', 'restored', 'report', 'setupBytes', 'claimed']) {
    for (const value of [undefined, null, {}, []]) {
      assert.throws(() => validateContinuousDeviceEvidence({ ...fixture(), [key]: value }), key);
    }
  }
});
