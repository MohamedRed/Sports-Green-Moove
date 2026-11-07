import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { preparePinnedApks, assertContinuousDevice } from './preinstalled-disposable-apks.mjs';
import { disposableTestRunner } from './install-disposable-test-apks.mjs';
import { parseAndroidJUnitTranscript, androidJUnitXml } from './android-junit-transcript.mjs';
import { primaryCaptureDiagnosticArguments, collectPrimaryCaptureDiagnostics } from './collect-primary-capture-diagnostics.mjs';

assert.equal(process.env.SGM_FOCUSED_UI_CASE, 'full-matrix');
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const directory = resolve(android, 'app/build/outputs/store-review-screenshots');
const device = disposableAndroidShell();
const preparation = preparePinnedApks({ android, serial: device.serial, device });
const binding = JSON.parse(readFileSync(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT));
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const result = spawnSync(adb, ['-s', device.serial, 'shell', 'am', 'instrument', '-w', '-r',
  '-e', 'timeout_msec', '240000', '-e', 'sgmBlockInstallations', 'true',
  ...primaryCaptureDiagnosticArguments(process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS),
  `be.sportgreenmoove.app.test/${disposableTestRunner}`],
{ encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const redact = input => {
  let value = String(input ?? '');
  if (process.env.SGM_GOOGLE_MAPS_ANDROID_API_KEY) value = value.replaceAll(process.env.SGM_GOOGLE_MAPS_ANDROID_API_KEY, '[REDACTED]');
  return value.replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[REDACTED]');
};
const transcript = redact(result.stdout), stderr = redact(result.stderr);
writeFileSync(resolve(directory, 'ordinary-instrumentation.txt'), transcript, { mode: 0o600, flag: 'wx' });
writeFileSync(resolve(directory, 'ordinary-process.json'), JSON.stringify({
  scope: 'single-ordinary-instrumentation-command-not-flow-proof', status: result.status, signal: result.signal,
  errorCode: result.error ? 'INSTRUMENTATION_PROCESS_ERROR' : null, stderr,
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
assert.equal(result.status, 0, 'Ordinary instrumentation command failed'); assert.equal(result.signal, null); assert(!result.error);
const report = parseAndroidJUnitTranscript(transcript);
assertContinuousDevice(device, binding);
writeFileSync(resolve(directory, 'ordinary-results.json'), JSON.stringify({ ...report, preparation,
  installationsRemainedBlocked: true, productionWritesAccepted: false, physicalDeviceAccepted: false,
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const xml = resolve(android, 'app/build/outputs/androidTest-results/connected/debug'); mkdirSync(xml, { recursive: true });
writeFileSync(resolve(xml, 'TEST-guarded-components.xml'), androidJUnitXml(report), { flag: 'wx' });
console.log(`Ordinary Android matrix: ${report.passed} passed, ${report.skipped} skipped, ${report.failed} failed; ${report.caseCount} cases observed.`);
const diagnostic = process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS === 'true' ? collectPrimaryCaptureDiagnostics({
  adb, serial: device.serial, directory, ordinaryPassed: report.failed === 0,
}) : null;
assert(report.passed > 0 && report.failed === 0, 'All discovered ordinary Android cases must complete without a failure');
if (diagnostic) assert(diagnostic.ok, 'Primary capture observations are incomplete; no capture repair is claimed');
