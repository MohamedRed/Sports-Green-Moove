import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { prepareDisposableTestApks, installationGuardArguments, disposableTestRunner, disposableApkSourceFiles } from './install-disposable-test-apks.mjs';
import { restoreContinuousDevice } from './continuous-disposable-device.mjs';
import { collectLocalUiEvidence } from './collect-local-ui-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertLocalApkIdentity } from './local-apk-identity.mjs';
import { assertContinuousDevice } from './preinstalled-disposable-apks.mjs';

const [receiptPath, directory, mode, cleanupOwner] = process.argv.slice(2);
assert(mode === undefined || mode === '--reads');
assert(cleanupOwner === undefined || cleanupOwner === '--focused-shell-restores');
const shellRestores = cleanupOwner === '--focused-shell-restores';
assert(!shellRestores || mode === '--reads');
const reads = mode === '--reads';
const componentClass = reads ? 'TeamConversationReadFlowTest' : 'TeamConversationFlowTest';
const markerScope = reads ? 'local-team-chat-read-component-with-fake-gateway-not-connected-or-physical'
  : 'local-team-chat-component-with-fake-gateway-not-connected-or-physical';
assert(isAbsolute(receiptPath ?? '') && isAbsolute(directory ?? '') && !existsSync(directory));
const setup = JSON.parse(readFileSync(receiptPath));
const root = resolve(import.meta.dirname, '../..'), android = resolve(root, 'android');
const device = disposableAndroidShell(), { serial } = device;
assert.equal(setup.serial, serial); assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
assert.equal(setup.case, shellRestores ? 'team-read-components' : 'team-chat-components');
assert.equal(process.env.SGM_FOCUSED_UI_CASE, setup.case);
assert.equal(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT, receiptPath);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 120_000, stdio: 'pipe' });
const runId = randomBytes(16).toString('hex'), redaction = randomBytes(24).toString('hex');
const sources = ['scripts/qa/run-team-chat-components.mjs', 'scripts/qa/collect-local-ui-evidence.mjs',
  ...(shellRestores ? ['scripts/qa/run-local-team-read-components-ui.mjs'] : []),
  'scripts/qa/local-apk-identity.mjs', ...disposableApkSourceFiles,
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversationFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversationReadFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamConversationReadUiFixture.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/TeamChatComponentCapture.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt',
  ...['TeamConversationDirectory.kt', 'TeamConversationRoute.kt', 'TeamConversationScreen.kt', 'TeamConversationState.kt',
    'ConversationComposerState.kt', 'MessagesRoute.kt', 'MessagesNavigation.kt', 'MessagesInboxRoute.kt']
    .map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file)];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = Object.fromEntries(sources.map((file) => [file, sha(readFileSync(resolve(root, file)))]));
const apkHashes = Object.fromEntries(['apk/debug/app-debug.apk', 'apk/androidTest/debug/app-debug-androidTest.apk']
  .map((file) => [file, sha(readFileSync(resolve(android, 'app/build/outputs', file)))]));
mkdirSync(directory); writeFileSync(resolve(directory, 'device-setup.json'), JSON.stringify(setup, null, 2) + '\n');
let transcript, failure, restored, screenshots, apkPreparation;
try {
  assertLocalApkIdentity(android, process.env.ANDROID_HOME);
  apkPreparation = prepareDisposableTestApks({ adb, serial, android, run });
  assert.equal(apkPreparation.installationsRemainedBlocked, true);
  transcript = execFileSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '180000',
    ...installationGuardArguments(), '-e', 'class', `be.sportgreenmoove.app.ui.${componentClass}`,
    `be.sportgreenmoove.app.local.test/${disposableTestRunner}`], { encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  writeFileSync(resolve(directory, 'instrumentation.txt'), transcript, { flag: 'wx' });
  assertInstrumentationPassed(transcript, 3);
  collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'team-chat-components', runId, password: redaction });
  const stems = reads ? ['team-read-count-narrow', 'team-read-visible', 'team-read-error', 'team-read-retry', 'team-read-revoked']
    : ['team-chat-narrow', 'team-chat-denied', 'team-chat-unconfirmed', 'team-chat-confirmed'];
  const names = stems.flatMap((name) => [name + '.png', name + '-window.png']).sort();
  assert.deepEqual(readdirSync(directory).filter((file) => file.endsWith('.png')).sort(), names);
  screenshots = Object.fromEntries(names.map((name) => [name, sha(readFileSync(resolve(directory, name)))]));
  for (const stem of stems) {
    const marker = JSON.parse(readFileSync(resolve(directory, stem + '.json')));
    assert.equal(marker.scope, markerScope);
    assert.equal(marker.completed, true); assert.equal(marker.case, stem);
    assert.equal(marker.imageSha256, screenshots[stem + '.png']);
    assert.equal(marker.windowSha256, screenshots[stem + '-window.png']);
  }
  for (const [file, hash] of Object.entries(sourceFiles)) assert.equal(sha(readFileSync(resolve(root, file))), hash, 'Source changed during execution');
  assertContinuousDevice(device, setup);
} catch (error) {
  failure = error;
  if (!transcript && error.stdout) writeFileSync(resolve(directory, 'instrumentation-failed.txt'), String(error.stdout), { flag: 'wx' });
  try { collectLocalUiEvidence({ adb, serial, evidenceDir: directory, phase: 'failure-cleanup', runId, password: redaction }); }
  catch { console.warn('Partial captures unavailable; original component failure preserved.'); }
}
if (!shellRestores) try {
  restored = restoreContinuousDevice(device, setup);
  writeFileSync(resolve(directory, 'device-restored.json'), JSON.stringify(restored, null, 2) + '\n');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.restoration.localPackagesRemoved, true);
  assert.equal(restored.restoration.installAdmin?.authorizationRemoved, true); assert.equal(restored.restoration.installAdmin?.componentRemoved, true);
} catch (error) {
  if (error.receipt) writeFileSync(resolve(directory, 'device-restoration-failed.json'), JSON.stringify(error.receipt, null, 2) + '\n', { flag: 'wx' });
  failure = failure ? new AggregateError([failure, error], 'Component test and device restoration failed') : error;
}
if (failure) throw failure;
writeFileSync(resolve(directory, 'results.json'), JSON.stringify({ projectId: 'demo-sgm-local-qa', runId,
  testedAt: new Date().toISOString(), scope: reads ? 'local-team-chat-read-components-with-fake-gateway-not-connected-or-physical'
    : 'local-team-chat-components-with-fake-gateway-not-connected-or-physical',
  componentCaseCount: 3, connectedBackend: false, notificationsVerified: false,
  steps: (reads ? ['team-read-count-and-visible-rows-only', 'team-read-error-and-explicit-retry-landscape', 'team-read-authority-rejection-hides-thread']
    : ['team-chat-entry-and-narrow-layout', 'team-chat-authorization-failure-hides-thread',
      'team-chat-unconfirmed-send-reuses-one-intent']).map(id => ({ id, status: 'passed' })),
  physicalDevice: false, productionWrites: false,
  ...(shellRestores ? { cleanupOwner: 'focused-shell-independent-restoration-receipt-required' }
    : { devicePolicyRestored: true, localPackagesRemoved: true }),
  transcriptSha256: sha(Buffer.from(transcript)), screenshots, sourceFiles, apkHashes, apkPreparation }, null, 2) + '\n', { flag: 'wx' });
console.log('Three team-chat component cases passed; connected native exchange and notifications remain unverified.');
