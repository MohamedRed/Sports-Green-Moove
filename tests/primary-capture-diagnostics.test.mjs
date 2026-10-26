import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseDocument } from 'yaml';
import { collectPrimaryCaptureDiagnostics, primaryCaptureDiagnosticArguments } from '../scripts/qa/collect-primary-capture-diagnostics.mjs';
import { captureDiagnosticScope, requiredTripCaptureNames, validatePrimaryCaptureDiagnostic } from '../scripts/qa/primary-capture-diagnostic-schema.mjs';
import { fileURLToPath } from 'node:url';
import { validateCaptureCallbackInvestigation, validateCaptureInvestigationReport } from '../scripts/qa/capture-callback-investigation-evidence.mjs';
import { validateCaptureRuntimeEvidence, validateCaptureRuntimeReport } from '../scripts/qa/capture-runtime-evidence.mjs';
import { content } from '../partner-portal/content.mjs';
import { evidenceSourcePaths } from '../partner-portal/evidence-fingerprints.mjs';

const trace = (captureName = requiredTripCaptureNames[0]) => ({ schemaVersion: 1, scope: captureDiagnosticScope, captureName,
  sdkInvocations: 1, primaryOutcome: 'returned', errorCategory: 'none', elapsedMs: 125,
  primaryStartOffsetMs: 5, primaryElapsedMs: 120,
  callerIsMain: false, mainPostAccepted: true, heartbeatDelaysMs: [2, 3], heartbeatAtMs: [55, 108], maxMainQueueDelayMs: 3,
  samples: [], sampleFailures: 0, observerClosed: true, observerMayAffectScheduling: true, imagesWrittenByObserver: false });
const prepared = () => ({ ...trace(), sdkInvocations: 0, primaryOutcome: 'prepared', elapsedMs: 0,
  primaryStartOffsetMs: null, primaryElapsedMs: null,
  observerClosed: false, mainPostAccepted: false, heartbeatDelaysMs: [], heartbeatAtMs: [], maxMainQueueDelayMs: null });
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('six actual successful observations do not claim failure reproduction, a repair or physical release proof', () => {
  validateCaptureRuntimeEvidence(fileURLToPath(new URL('..', import.meta.url)));
  for (const name of ['README.md', 'artifact-sha256.json'])
    assert(evidenceSourcePaths(content).includes('docs/release/evidence/capture-callback-runtime-2026-10-26/' + name));
  const report = JSON.parse(read('docs/release/evidence/capture-callback-runtime-2026-10-26/analysis.json'));
  for (const key of ['failureReproduced', 'rootCauseProven', 'primaryApiModified', 'primaryDeadlineModified',
    'outerRetryAdded', 'alternateCaptureAdded', 'physicalDevice', 'newScreenshotsAccepted', 'releaseAccepted'])
    assert.throws(() => validateCaptureRuntimeReport({ ...report, [key]: true }));
  assert.throws(() => validateCaptureRuntimeReport({ ...report, contractCasesExecuted: 0 }));
  assert.throws(() => validateCaptureRuntimeReport({ ...report, runtimeTimingCollected: false }));
});
test('a passing baseline and compiled probe cannot claim runtime timing, a root repair or release proof', () => {
  validateCaptureCallbackInvestigation(fileURLToPath(new URL('..', import.meta.url)));
  const report = JSON.parse(read('docs/release/evidence/capture-callback-investigation-2026-10-26/analysis.json'));
  for (const key of ['contractCasesExecuted', 'runtimeTimingCollected', 'primaryApiModified', 'primaryDeadlineModified',
    'outerRetryAdded', 'alternateCaptureAdded', 'rootCauseProven', 'physicalDevice', 'newScreenshotsAccepted', 'releaseAccepted'])
    assert.throws(() => validateCaptureInvestigationReport({ ...report, probe: { ...report.probe, [key]: true } }));
  assert.throws(() => validateCaptureInvestigationReport({ ...report, localLibrary: { ...report.localLibrary, callbackWaitMs: 10_000 } }));
});

function collect(rows, { ordinaryPassed = true, process = { status: 0, signal: null }, edit } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-capture-schema-'));
  try {
    let calls = 0;
    const receipt = collectPrimaryCaptureDiagnostics({ adb: '/fake/adb', serial: 'emulator-5554', directory, ordinaryPassed,
      run(command, args, options) {
        calls++; assert.equal(command, '/fake/adb'); assert.equal(options.timeout, 20_000);
        assert.deepEqual(args.slice(0, -1), ['-s', 'emulator-5554', 'pull',
          '/sdcard/Android/data/be.sportgreenmoove.app/files/primary-capture-diagnostics']);
        const folder = join(args.at(-1), 'primary-capture-diagnostics'); mkdirSync(folder);
        rows.forEach((row, index) => writeFileSync(join(folder,
          row.captureName.replace(/\.png$/, '') + '-' + (index + 1) + '.json'), JSON.stringify(row)));
        edit?.(folder);
        return process;
      } });
    assert.equal(calls, 1);
    const encoded = readFileSync(join(directory, 'capture-timing/collection.json'), 'utf8');
    assert.deepEqual(JSON.parse(encoded), receipt);
    for (const [path, hash] of Object.entries(receipt.files)) assert.equal(createHash('sha256')
      .update(readFileSync(join(directory, 'capture-timing', path))).digest('hex'), hash);
    return { receipt, encoded };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('diagnostics are opt-in and reject ambiguous configuration rather than enabling a substitute', () => {
  for (const value of [undefined, 'false']) assert.deepEqual(primaryCaptureDiagnosticArguments(value), []);
  assert.deepEqual(primaryCaptureDiagnosticArguments('true'), ['-e', 'sgmPrimaryCaptureDiagnostics', 'true']);
  for (const value of ['', 'TRUE', '1', 'yes', true]) assert.throws(() => primaryCaptureDiagnosticArguments(value));
});
test('one bounded copy retains hashes for every required primary capture when the ordinary suite passes', () => {
  const { receipt } = collect(requiredTripCaptureNames.map(trace));
  assert.equal(receipt.ok, true); assert.equal(receipt.ordinaryPassed, true);
  assert.equal(receipt.traces.length, 6); assert.equal(Object.keys(receipt.files).length, 6);
  assert.match(receipt.scope, /not-flow-or-root-cause-proof/);
});
test('a fully recorded SDK failure is diagnostic evidence, never a successful ordinary suite', () => {
  const failed = { ...trace(requiredTripCaptureNames[4]), primaryOutcome: 'threw',
    errorCategory: 'pixelcopy-callback-wait', elapsedMs: 1110, primaryStartOffsetMs: 10, primaryElapsedMs: 1100 };
  const { receipt } = collect([failed], { ordinaryPassed: false });
  assert.equal(receipt.ok, true); assert.equal(receipt.ordinaryPassed, false);
  assert.equal(receipt.traces[0].primaryOutcome, 'threw');
  const runner = read('scripts/qa/run-ordinary-android-ui.mjs');
  assert(runner.indexOf('collectPrimaryCaptureDiagnostics({') < runner.indexOf("assert(report.passed > 0 && report.failed === 0"));
  assert(runner.indexOf("assert(report.passed > 0 && report.failed === 0") < runner.indexOf('if (diagnostic) assert(diagnostic.ok'));
});
test('prepared and incomplete observer records cannot claim a complete capture observation', () => {
  assert.equal(validatePrimaryCaptureDiagnostic(prepared()).complete, false);
  for (const row of [prepared(), { ...trace(), observerClosed: false }, { ...trace(), sampleFailures: 1 },
    { ...trace(), mainPostAccepted: false }]) {
    const { receipt } = collect([row], { ordinaryPassed: false });
    assert.equal(receipt.ok, false); assert.equal(receipt.errorCode, 'INCOMPLETE_CAPTURE_OBSERVATION');
  }
});
test('raw exception messages, contact values, image claims, retries and invalid timing data are rejected', () => {
  for (const patch of [{ message: 'private value' }, { phone: '+12025550121' }, { rootCauseProven: true },
    { imagesWrittenByObserver: true }, { observerMayAffectScheduling: false }, { sdkInvocations: 2 },
    { elapsedMs: -1 }, { elapsedMs: .5 }, { primaryOutcome: 'returned', errorCategory: 'other' },
    { maxMainQueueDelayMs: 0 }, { sampleFailures: 4 }]) assert.throws(() => validatePrimaryCaptureDiagnostic({ ...trace(), ...patch }));
  assert.equal(collect([{ ...trace(), rawMessage: 'never exported' }], { ordinaryPassed: false }).receipt.errorCode,
    'DIAGNOSTIC_VALIDATION_FAILED');
});
test('observer setup is separate from primary duration and heartbeats retain their timeline positions', () => {
  const row = { ...trace(), elapsedMs: 1125, primaryStartOffsetMs: 1005, primaryElapsedMs: 120,
    heartbeatDelaysMs: [5], heartbeatAtMs: [1055], maxMainQueueDelayMs: 5 };
  const { receipt } = collect([row], { ordinaryPassed: false });
  assert.equal(receipt.ok, true); assert.equal(receipt.traces[0].primaryElapsedMs, 120);
  assert.equal(receipt.traces[0].primaryStartOffsetMs, 1005);
  for (const patch of [{ primaryStartOffsetMs: null }, { primaryElapsedMs: 1100 }, { heartbeatAtMs: [] },
    { heartbeatAtMs: [108, 55], heartbeatDelaysMs: [2, 3], maxMainQueueDelayMs: 3 }])
    assert.throws(() => validatePrimaryCaptureDiagnostic({ ...row, ...patch }));
});
test('stack samples are bounded metadata and retain unknown queue responsiveness as null, not zero', () => {
  const frame = { className: 'example.Capture', methodName: 'capture', fileName: 'Capture.kt', lineNumber: 20 };
  const sample = { atMs: 651, scheduledMs: 610, offsetMs: 600, observerDelayMs: 41, mainState: 'RUNNABLE', mainFrames: [frame], callerFrames: [frame] };
  assert.equal(validatePrimaryCaptureDiagnostic({ ...trace(), samples: [sample] }).complete, true);
  assert.equal(validatePrimaryCaptureDiagnostic({ ...trace(), heartbeatDelaysMs: [], heartbeatAtMs: [], maxMainQueueDelayMs: null }).complete, true);
  for (const patch of [{ observerDelayMs: 0 }, { mainState: 'unknown' }, { offsetMs: 700 },
    { mainFrames: Array(21).fill(frame) }, { callerFrames: [{ ...frame, fileName: '/private/value' }] }])
    assert.throws(() => validatePrimaryCaptureDiagnostic({ ...trace(), samples: [{ ...sample, ...patch }] }));
});
test('a missing capture or extra image cannot become a complete passing-suite diagnostic inventory', () => {
  for (const rows of [[trace()], [trace(), trace()]]) assert.equal(collect(rows).receipt.ok, false);
  const result = collect([trace()], { ordinaryPassed: false, edit(folder) { writeFileSync(join(folder, 'image.png'), 'no'); } });
  assert.equal(result.receipt.errorCode, 'DIAGNOSTIC_VALIDATION_FAILED');
});
test('copy errors preserve their status without retaining stderr, using another device, or retrying', () => {
  for (const process of [{ status: 1, stderr: 'private stderr' }, { status: null, signal: 'SIGTERM' },
    { status: 0, error: new Error('private error') }]) {
    const result = collect([], { ordinaryPassed: false, process });
    assert.equal(result.receipt.ok, false); assert.equal(result.receipt.errorCode, 'DIAGNOSTIC_COPY_FAILED');
    assert(!result.encoded.includes('private'));
  }
});
test('existing collection receipts and physical device serials are refused without overwriting evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-capture-existing-'));
  try {
    mkdirSync(join(directory, 'capture-timing')); writeFileSync(join(directory, 'capture-timing/collection.json'), 'original');
    assert.throws(() => collectPrimaryCaptureDiagnostics({ directory, serial: 'physical', ordinaryPassed: true }));
    assert.throws(() => collectPrimaryCaptureDiagnostics({ directory, serial: 'emulator-5554', ordinaryPassed: true }));
    assert.equal(readFileSync(join(directory, 'capture-timing/collection.json'), 'utf8'), 'original');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('the original capture method, image validation and single-operation exception semantics remain intact', () => {
  const base = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const capture = read(base + 'LocalUiCapture.kt');
  assert(capture.includes('observePrimaryCapture(name) { window.captureToImage().asAndroidBitmap() }'));
  assert(capture.includes('Blank test capture rejected')); assert(!capture.includes('catch'));
  const wrapper = read(base + 'PrimaryCaptureDiagnostics.kt');
  assert(wrapper.includes('throw failure')); assert(wrapper.includes('primaryFailure?.addSuppressed(diagnosticFailure)'));
  assert(!wrapper.includes('captureToImage')); assert(!wrapper.includes('PixelCopy.request')); assert(!wrapper.includes('repeat('));
  const probe = read(base + 'PrimaryCaptureProbe.kt');
  assert(probe.includes('listOf(250L, 600L, 900L)')); assert(probe.includes('handler.removeCallbacks(heartbeat)'));
  assert(probe.includes('executor.shutdownNow()')); assert(!probe.includes('Thread.sleep')); assert(!probe.includes('Bitmap'));
});
test('only the ordinary disposable-device job opts in and web smoke protects the diagnostic protocol', () => {
  const workflow = parseDocument(read('.github/workflows/native-ci.yml')).toJSON();
  const boot = workflow.jobs['android-native-ui'].steps.find(step => step.uses === 'reactivecircus/android-emulator-runner@v2');
  assert.equal(boot.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS, 'true');
  assert.equal(boot.with['emulator-options'], '-no-window -gpu software -no-snapshot -noaudio -no-boot-anim');
  assert.equal(read('.github/workflows/native-ci.yml').split('SGM_PRIMARY_CAPTURE_DIAGNOSTICS:').length - 1, 1);
  assert(read('.github/workflows/web-integration-smoke.yml').includes('node --test tests/primary-capture-diagnostics.test.mjs'));
});
