import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, cpSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateNeutralTextUnits, validateNeutralTextCaptureFiles, neutralTextCases } from '../scripts/qa/neutral-text-contrast-evidence.mjs';
import {neutralVisualSource, validateNeutralTextVisualReview} from '../scripts/qa/neutral-text-visual-evidence.mjs';
import {validateAppearanceEvidence} from '../partner-portal/appearance-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const main = 'android/app/src/main/java/be/sportgreenmoove/app/design/';
const native = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';

test('actual JVM baseline and corrected production-token pairs retain ten failures then thirty passing ratios', () => {
  const result = validateNeutralTextUnits(root);
  assert.equal(result.pairs, 30); assert.equal(result.originalFailures, 10); assert.equal(result.currentFailures, 0);
  assert(result.minimumContrast >= 4.5);
});

test('palette extraction removes duplicate legacy definitions and keeps the brand and hero text unchanged', () => {
  const colors = read(main + 'SgmColors.kt'), theme = read(main + 'SgmTheme.kt');
  assert(!theme.includes('object SgmColor {')); assert(!theme.includes('val SgmLightColors ='));
  for (const value of ['0xFF56735E', '0xFF8AA892', '0xFF3EBD6C', '0xFFF97316', 'val TextOnGreen = Color.White'])
    assert(colors.includes(value), value);
  for (const value of ['0xFF7A9E82', '0xFF4E6E56']) assert(!colors.includes(value));
  for (const file of ['SgmColors.kt', 'SgmTheme.kt']) assert(read(main + file).split('\n').length < 300);
  const unit = read('android/app/src/test/java/be/sportgreenmoove/app/design/SgmTextContrastTest.kt');
  assert(unit.includes('compositeOver(background)')); assert(unit.includes('ratio >= 4.5'));
});

test('eight planned native component captures use real screen components, both themes and enlarged fixed viewports', () => {
  assert.equal(neutralTextCases.length, 8); assert.equal(new Set(neutralTextCases).size, 8);
  const suite = read(native + 'NeutralTextLayoutTest.kt'), capture = read(native + 'NeutralTextCapture.kt');
  for (const required of ['TripsScreen(', 'SearchScreen(', 'SgmTheme(darkTheme = dark)', 'fontScale = 1.3f',
    '320, 700, 3f', '900, 600, 1f', 'ro.kernel.qemu']) assert(suite.includes(required), required);
  for (const required of ['captureToImage()', 'bitmap.width ==', 'colors.size > 16', 'viewportSha256', 'windowSha256',
    'executed-local-neutral-text-components-not-full-app-or-physical', 'cp -n', 'sha256sum']) assert(capture.includes(required), required);
  assert(!suite.includes('AndroidRuntime.create'));
  const shell = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert(shell.includes('adb pull /sdcard/Download/sgm-neutral-text'));
  assert(shell.includes('Missing neutral text evidence:'));
  assert(shell.includes('for suffix in .png -window.png .json'));
});

test('native and web smoke retain the token regression and component evidence contract', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = read('.github/workflows/' + name);
    assert.equal(workflow.split('"tests/neutral-text-contrast.test.mjs"').length - 1, 2);
    assert(workflow.includes('node --test tests/neutral-text-contrast.test.mjs'));
  }
});

test('capture-integrity checks require all eight original frames, windows and correctly bound metadata', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-neutral-integrity-unit-'));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  // Header fixtures exercise metadata/integrity only, never rendered-image acceptance.
  const header = (width, height) => {
    const bytes = Buffer.alloc(2048); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
    bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes;
  };
  try {
    for (const name of neutralTextCases) {
      const [screen, theme, format] = name.split('-');
      const [widthDp, heightDp, density] = format === 'phone' ? [320, 700, 3] : [900, 600, 1];
      const viewport = header(widthDp * density, heightDp * density), window = header(1080, 2400);
      writeFileSync(resolve(directory, name + '.png'), viewport); writeFileSync(resolve(directory, name + '-window.png'), window);
      writeFileSync(resolve(directory, name + '.json'), JSON.stringify({ case: name, screen, dark: theme === 'dark',
        scope: 'executed-local-neutral-text-components-not-full-app-or-physical', widthDp, heightDp, density,
        fontScale: 1.3, physicalDevice: false, capturedAtEpochMillis: 1, completed: true,
        viewportSha256: sha(viewport), windowSha256: sha(window) }));
    }
    assert.equal(validateNeutralTextCaptureFiles(directory).records.length, 8);
    const path = resolve(directory, neutralTextCases[0] + '.json'), original = JSON.parse(readFileSync(path));
    for (const change of [r => { r.dark = !r.dark; }, r => { r.fontScale = 1; }, r => { r.physicalDevice = true; },
      r => { r.viewportSha256 = '0'.repeat(64); }, r => { r.windowSha256 = '0'.repeat(64); }, r => { r.widthDp = 321; }]) {
      const value = structuredClone(original); change(value); writeFileSync(path, JSON.stringify(value));
      assert.throws(() => validateNeutralTextCaptureFiles(directory));
    }
    writeFileSync(path, JSON.stringify(original)); rmSync(resolve(directory, neutralTextCases[7] + '.png'));
    assert.throws(() => validateNeutralTextCaptureFiles(directory));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('eight reviewed original viewports bind to successful CI cases without physical or global contrast acceptance', () => {
  const review = validateNeutralTextVisualReview(root);
  assert.equal(review.reviewedViewports, 8); assert.equal(review.tokenMeasurements.pairs, 30);
  assert.equal(review.tokenMeasurements.currentFailures, 0);
  validateAppearanceEvidence(root, content.flows.find(flow => flow.id === 'appearance'), captures);
});

test('even freshly checksummed reviews cannot promote the bounded viewports to broader proof', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-neutral-review-negative-'));
  const evidence = resolve(temporary, 'docs/release/evidence'); mkdirSync(evidence, {recursive: true});
  cpSync(resolve(root, neutralVisualSource), resolve(temporary, neutralVisualSource), {recursive: true});
  for (const name of ['source-archive', 'neutral-text-contrast-2026-10-20'])
    symlinkSync(resolve(root, 'docs/release/evidence', name), resolve(evidence, name));
  const folder = resolve(temporary, neutralVisualSource), original = JSON.parse(readFileSync(resolve(folder, 'review.json')));
  const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  const change = transform => {
    const review = structuredClone(original); transform(review);
    const bytes = JSON.stringify(review, null, 2) + '\n';
    writeFileSync(resolve(folder, 'review.json'), bytes);
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify({...hashes,
      'review.json': createHash('sha256').update(bytes).digest('hex')}));
  };
  try {
    validateNeutralTextVisualReview(temporary);
    for (const key of ['physicalDevice', 'connectedFlow', 'screenReaderVerified', 'accentContrastAccepted',
      'systemInsetsAccepted', 'releaseAccepted', 'mediaEdits', 'neutralTextOverlapObserved']) {
      change(review => {review[key] = true;}); assert.throws(() => validateNeutralTextVisualReview(temporary), key);
    }
    for (const mutate of [review => {review.cases.pop();}, review => {review.sourceCommit = '0'.repeat(40);},
      review => {review.fontScale = 1;}, review => {review.sourceFiles = {};}, review => {review.reviewedAt = '2026-10-31';}]) {
      change(mutate); assert.throws(() => validateNeutralTextVisualReview(temporary));
    }
  } finally {rmSync(temporary, {recursive: true, force: true});}
});

test('appearance preserves historical dates and cannot turn a partial visual review into a completed flow', () => {
  const original = content.flows.find(flow => flow.id === 'appearance');
  assert.deepEqual(original.images.slice(-2).map(image => image.checkedAt), ['2026-10-15', '2026-10-15']);
  for (const mutate of [flow => {flow.status = 'verified';}, flow => {flow.ui.checkedAt = '2026-10-30';},
    flow => {flow.images.pop();}, flow => {flow.images[0].landscape = true;}]) {
    const flow = structuredClone(original); mutate(flow); assert.throws(() => validateAppearanceEvidence(root, flow, captures));
  }
  const browserCopy = JSON.stringify({flow: original, progress: content.updates.filter(entry => entry.flow === 'appearance')});
  assert(!/BrowserStack|Firebase|Compose|Jetpack|Playwright/.test(browserCopy));
});
