import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {signOutConnectedFolder as folder, validateSignOutConnected} from '../partner-portal/team-push-signout-connected-validation.mjs';
import {content} from '../partner-portal/content.mjs';
import {exitGateFolder, validateExitGate} from '../partner-portal/team-push-exit-gate-validation.mjs';

test('the actual wide-capture rejection and independent failed network copies keep the full gate negative', () => {
  const result = validateExitGate(process.cwd()); assert.equal(result.fullGatePassed, false);
  const update = content.updates.find(row => row.source === exitGateFolder + 'README.md'); assert(update);
  assert.match(update.text, /à rejouer après correction/);
  assert.equal(content.blockers.find(row => row.id === 'native-evidence-copy').latestSource, exitGateFolder + 'README.md');
});

test('the existing focused lane replays the exact exit class without replacing read cases or relaxing the capture guard', () => {
  const read = file => readFileSync(resolve(file), 'utf8');
  const entry = read('scripts/qa/run-local-team-read-components-ui.mjs');
  assert(entry.indexOf('run-team-chat-components.mjs') < entry.indexOf('run-session-shutdown-components.mjs'));
  const runner = read('scripts/qa/run-session-shutdown-components.mjs');
  for (const text of ['SessionShutdownFlowTest', 'assertInstrumentationPassed(transcript, 3)', 'assertContinuousDevice(device, setup)',
    'assertLocalApkIdentity', 'session-exit-narrow.png', 'session-exit-wide-dark.png', 'focused-shell-independent-restoration-receipt-required'])
    assert(runner.includes(text));
  const frame = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionShutdownFlowTest.kt');
  assert(frame.includes('captureLocalUi(compose, capture, landscape = frame.width > frame.height)'));
  assert(frame.includes('if (dark) assertTrue(frame.width > frame.height)'));
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt');
  assert(capture.includes('check((bitmap.width > bitmap.height) == landscape)'));
  assert(!read('android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt').includes('FLAG_SECURE'));
});

test('the app exit and independent inactive local state are proven without accepting a real token or phone', () => {
  const result = validateSignOutConnected(process.cwd()); assert.equal(result.authenticatedSyntheticRemovalVerified, true);
  const flow = content.flows.find(row => row.id === 'team-conversation');
  assert.equal(flow.pushSignOutConnected.source, folder + 'review.json'); assert.equal(flow.status, 'partial');
  assert.equal(flow.phone.checkedAt, '2026-10-21'); assert.equal(flow.images.length, 62); assert.equal(flow.tour.length, 39);
  const update = content.updates.find(row => row.source === folder + 'README.md'); assert(update);
  assert.match(update.text, /en simulation/); assert.match(update.text, /sur téléphone/);
  assert.doesNotMatch(update.title + update.text, /\b(?:firebase|browserstack|SDK|API|token|FCM|CI)\b/i);
});
for (const [file, key, value] of [
  ['review.json', 'realPhoneTokenRegistered', true], ['review.json', 'physicalDevice', true],
  ['review.json', 'pushDeliveryVerified', true], ['review.json', 'tapNavigationVerified', true],
  ['review.json', 'releaseAccepted', true], ['review.json', 'realMessagingSdkCalls', 1],
  ['device.json', 'confirmedWhileAuthenticated', false], ['device.json', 'uiLoginReturned', false],
  ['copy.json', 'completed', false], ['restore.json', 'verified', false],
]) test(`even rehashed connected evidence rejects ${file} ${key}=${value}`, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-signout-connected-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(folder, temp, {recursive: true}); const path = resolve(temp, file), data = JSON.parse(readFileSync(path)); data[key] = value;
  writeFileSync(path, JSON.stringify(data)); const index = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(index));
  hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(index, JSON.stringify(hashes));
  assert.throws(() => validateSignOutConnected(process.cwd(), temp));
});
