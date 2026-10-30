import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {collectRejectedPrimaryBitmaps, rejectedBitmapScope, validateRejectedPrimaryBitmaps} from '../scripts/qa/rejected-primary-captures.mjs';
import {rejectedCaptureFolder, validateRejectedCaptureProbe} from '../scripts/qa/rejected-capture-probe-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function temporary(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-rejected-primary-'));
  t.after(() => rmSync(directory, {recursive: true, force: true})); return directory;
}
function fixture(directory, mutate = () => {}) {
  const marker = {schemaVersion: 1, scope: rejectedBitmapScope, captureName: 'team-chat-confirmed.png',
    imageFile: 'team-chat-confirmed-1.png', imageSha256: digest(png), width: 1, height: 1,
    sampleStride: 16, minimumDistinctSampledColorsExclusive: 16, sampledColorCount: 1, sampledColorsArgb: ['00000000'],
    imageAccepted: false, flowVerified: false, replacementCaptureUsed: false, recordedAtEpochMillis: 1};
  mutate(marker); writeFileSync(resolve(directory, 'team-chat-confirmed-1.png'), png);
  writeFileSync(resolve(directory, 'team-chat-confirmed-1.json'), JSON.stringify(marker));
}
function env(t) {
  for (const key of ['SGM_LOCAL_DISPOSABLE_EMULATOR', 'SGM_PRIMARY_CAPTURE_DIAGNOSTICS']) {
    const original = process.env[key]; process.env[key] = 'true';
    t.after(() => {if (original === undefined) delete process.env[key]; else process.env[key] = original;});
  }
}
test('a rejected diagnostic verifies only its container header and digest, never accepts an app image or flow', t => {
  const directory = temporary(t); fixture(directory);
  assert.deepEqual(validateRejectedPrimaryBitmaps(directory), {pairCount: 1, containerHeaderAndDigestVerified: true,
    pixelsIndependentlyDecoded: false, imageAccepted: false, flowVerified: false});
});
for (const [name, mutate] of [
  ['accepted image', r => r.imageAccepted = true], ['passed flow', r => r.flowVerified = true],
  ['replacement', r => r.replacementCaptureUsed = true], ['changed digest', r => r.imageSha256 = '0'.repeat(64)],
  ['escaped path', r => r.imageFile = '../private.png'], ['wrong dimensions', r => r.height = 2],
  ['lower threshold', r => r.minimumDistinctSampledColorsExclusive = 1], ['changed sampling', r => r.sampleStride = 1],
  ['non-rejected count', r => r.sampledColorCount = 17], ['private field', r => r.token = 'private-diagnostic-token'],
]) test('rejects ' + name, t => {const directory = temporary(t); fixture(directory, mutate); assert.throws(() => validateRejectedPrimaryBitmaps(directory));});
test('one directory check and one copy retain the exact bytes without another capture or retry', t => {
  env(t); const directory = temporary(t), calls = [];
  const receipt = collectRejectedPrimaryBitmaps({adb: 'adb', serial: 'emulator-5588', directory}, (cmd, args) => {
    assert.equal(cmd, 'adb'); calls.push(args);
    if (calls.length === 1) return {status: 0};
    assert.deepEqual(args, ['-s', 'emulator-5588', 'pull',
      '/sdcard/Android/data/be.sportgreenmoove.app/files/rejected-primary-captures/.', resolve(directory, 'rejected-primary-captures')]);
    fixture(args.at(-1)); return {status: 0};
  });
  assert.equal(calls.length, 2); assert.equal(receipt.collectionStatus, 'retained');
  assert.equal(receipt.validatedPairCount, 1); assert.equal(receipt.imageAccepted, false); assert.equal(receipt.flowVerified, false);
  assert.throws(() => collectRejectedPrimaryBitmaps({adb: 'adb', serial: 'emulator-5588', directory}, () => assert.fail('Cannot retry')));
});
test('an unobserved directory is not called an accepted capture or proof of the root cause', t => {
  env(t); const directory = temporary(t); let calls = 0;
  const receipt = collectRejectedPrimaryBitmaps({adb: 'adb', serial: 'emulator-5588', directory}, () => {calls++; return {status: 1};});
  assert.equal(calls, 1); assert.equal(receipt.collectionStatus, 'not-observed'); assert.equal(receipt.copyAttempted, false);
  assert.equal(receipt.validatedPairCount, 0); assert.equal(receipt.imageAccepted, false);
  assert(!existsSync(resolve(directory, 'rejected-primary-captures')));
});
for (const result of [{status: 1, stderr: 'private-secret'}, {status: null, signal: 'SIGTERM'},
  {status: 0, error: new Error('private-secret')}]) test('directory command failures stay failed and discard raw output', t => {
  env(t); const directory = temporary(t); let calls = 0;
  const receipt = collectRejectedPrimaryBitmaps({adb: 'adb', serial: 'emulator-5588', directory}, () => {calls++; return result;});
  assert.equal(calls, 1); assert.equal(receipt.collectionStatus, 'failed'); assert.equal(receipt.copyAttempted, false);
  assert.equal(receipt.errorCode, 'DIRECTORY_CHECK_FAILED'); assert(!JSON.stringify(receipt).includes('private-secret'));
});
test('a failed file copy does not trigger another copy or replace the application capture', t => {
  env(t); const directory = temporary(t); let calls = 0;
  const receipt = collectRejectedPrimaryBitmaps({adb: 'adb', serial: 'emulator-5588', directory}, () => ++calls === 1
    ? {status: 0} : {status: 1, stderr: 'private-secret'});
  assert.equal(calls, 2); assert.equal(receipt.collectionStatus, 'failed'); assert.equal(receipt.errorCode, 'COPY_FAILED');
  assert.equal(receipt.copyCompleted, false); assert(!JSON.stringify(receipt).includes('private-secret'));
});
test('the successful capture path, quality threshold and original failure remain unchanged', () => {
  const base = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const capture = readFileSync(resolve(root, base, 'LocalUiCapture.kt'), 'utf8');
  assert(capture.includes('if (colors.size <= 16) retainRejectedPrimaryBitmap(name, bitmap, colors)'));
  assert(capture.indexOf('window.captureToImage()') < capture.indexOf('retainRejectedPrimaryBitmap('));
  assert(capture.indexOf('retainRejectedPrimaryBitmap(') < capture.indexOf('check(colors.size > 16)'));
  assert(capture.indexOf('check(colors.size > 16)') < capture.indexOf('bitmap.compress('));
  assert(capture.includes('Blank test capture rejected')); assert(!capture.includes('catch'));
  const writer = readFileSync(resolve(root, base, 'RejectedPrimaryBitmap.kt'), 'utf8');
  assert.doesNotMatch(writer, /captureToImage|takeScreenshot|PixelCopy|Thread\.sleep|repeat\(/);
  assert(writer.includes('name != "team-chat-confirmed.png"')); assert(writer.includes('if (!enabled'));
  assert(writer.includes('"rejected-primary-captures"')); assert(writer.includes('original quality failure unchanged'));
  assert(readFileSync(resolve(root, 'scripts/qa/collect-ordinary-android-failure.mjs'), 'utf8').includes('collectRejectedPrimaryBitmaps'));
});
test('physical device serials and unrelated packages are refused before commands or file writes', t => {
  env(t); const directory = temporary(t);
  for (const options of [{adb: 'adb', serial: 'physical-phone', directory},
    {adb: 'adb', serial: 'emulator-5592', directory, packageName: 'another.app'}]) {
    assert.throws(() => collectRejectedPrimaryBitmaps(options, () => assert.fail('Unapproved device command')));
    assert(!existsSync(resolve(directory, 'rejected-primary-copy.json')));
  }
});
test('all CI guard paths include the new protocol while the ordinary failure path stays diagnostic-only', () => {
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml', 'backend-ci.yml']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', file), 'utf8')).toJSON();
    assert(Object.values(workflow.jobs).some(job => job.steps?.some(step => step.run?.includes('tests/rejected-primary-captures.test.mjs'))), file);
  }
  const runner = readFileSync(resolve(root, 'scripts/run-android-ui-tests-and-collect-screenshots.sh'), 'utf8');
  assert(runner.includes('collect-ordinary-android-failure.mjs'));
  assert(runner.includes('"$test_status" -ne 0')); assert(runner.includes('"$capture_status" -ne 0'));
});
test('source-bound local baseline, startup failure and seven-case fresh probe retain distinct outcomes', () => {
  const result = validateRejectedCaptureProbe(root, content.rejectedCaptureRecheck);
  assert.equal(result.diagnosticCalibrationCases, 4); assert.equal(result.rootCauseProven, false);
  const update = content.updates.find(row => row.flow === 'native-startup');
  assert.equal(update.source, rejectedCaptureFolder + 'README.md'); assert.match(update.text, /local/);
  assert.doesNotMatch(update.text, /BrowserStack|Firebase|SDK|Android/);
  assert.equal(content.flows.find(row => row.id === 'team-conversation').status, 'partial');
  assert(content.updates.some(row => row.source === 'docs/release/evidence/native-followup-9bb6346-2026-10-30/README.md'));
});
for (const [file, mutate] of [
  ['summary.json', r => r.rootCauseProven = true], ['summary.json', r => r.primaryDeadlineModified = true],
  ['failed/results.json', r => r.completed = true], ['fresh/results.json', r => r.report.passed = 3],
  ['fresh/results.json', r => r.deviceRestorationVerified = false], ['fresh/rejected-primary-copy.json', r => r.collectionStatus = 'retained'],
  ['current-ci/native-suite-status.json', r => r.localReplay = 0], ['current-ci/local-chat-network-ui.json', r => r.completed = true],
]) test('retained probe rejects rehashed ' + file + ' contradiction', t => {
  const temp = temporary(t), base = resolve(temp, rejectedCaptureFolder);
  cpSync(resolve(root, rejectedCaptureFolder), base, {recursive: true});
  const archive = resolve(temp, 'docs/release/evidence/source-archive'); mkdirSync(dirname(archive), {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), archive);
  const path = resolve(base, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const manifest = resolve(base, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
  hashes[file] = digest(bytes); writeFileSync(manifest, JSON.stringify(hashes));
  assert.throws(() => validateRejectedCaptureProbe(temp));
});
