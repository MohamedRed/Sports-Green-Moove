import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const feedbackTextFolder = 'docs/release/evidence/status-feedback-contrast-2026-11-03/';
export const feedbackTextCases = ['notices', 'ride'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateFeedbackTextUnits(root) {
  const folder = resolve(root, feedbackTextFolder), json = file => JSON.parse(readFileSync(resolve(folder, file)));
  assertEvidenceBundleChecksums(folder);
  const stages = {}, sources = {}, parser = new XMLParser({ignoreAttributes: false});
  for (const [stage, count, failures] of [['before', 28, 18], ['after', 30, 0]]) {
    sources[stage] = json(stage + '/source-files.json'); assertRetainedSourceFiles(root, sources[stage]);
    const suite = parser.parse(readFileSync(resolve(folder, stage, stage === 'before' ? 'contrast-failed.xml' : 'contrast-passed.xml'))).testsuite;
    assert.equal(suite['@_tests'], String(count)); assert.equal(suite['@_failures'], String(failures));
    assert.equal(suite['@_errors'], '0'); assert.equal(suite.testcase.length, count);
    assert(suite.testcase.every(row => !Object.hasOwn(row, 'error') && !Object.hasOwn(row, 'skipped')));
    assert.equal(suite.testcase.filter(row => Object.hasOwn(row, 'failure')).length, failures);
    const measurements = suite['system-out'].trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(measurements, json(stage + '/measurements.json'));
    assert.equal(measurements.length, count);
    assert.deepEqual(suite.testcase.map(row => row['@_name']).sort(),
      measurements.map(row => `feedbackRemainsReadable[${row.case}]`).sort());
    assert.equal(new Set(measurements.map(row => row.case)).size, count);
    assert.equal(measurements.filter(row => row.contrastRatio < row.minimum).length, failures);
    stages[stage] = measurements;
  }
  for (const original of stages.before) {
    const current = stages.after.find(row => row.case === original.case); assert(current);
    assert.equal(current.minimum, original.minimum);
  }
  assert.deepEqual(stages.after.filter(row => !stages.before.some(old => old.case === row.case)).map(row => row.case).sort(),
    ['dark-on-material-error', 'light-on-material-error']);
  const unit = 'android/app/src/test/java/be/sportgreenmoove/app/design/SgmFeedbackContrastTest.kt';
  const archived = (stage, path) => readFileSync(resolve(root, 'docs/release/evidence/source-archive', sources[stage][path] + '.txt'), 'utf8');
  const normalized = archived('after', unit).split('\n').filter(line => !line.includes('"$mode-on-material-error"')).join('\n')
    .replaceAll('palette.textAccent.toArgb()', 'SgmColor.Green.toArgb()')
    .replaceAll('palette.textWarning.toArgb()', 'SgmColor.Orange.toArgb()')
    .replaceAll('palette.textError.toArgb()', 'SgmColor.Red.toArgb()');
  assert.equal(normalized, archived('before', unit), 'Only actual foreground-role lookups and two on-error cases may change');
  const review = json('review.json');
  assert.equal(review.scope, 'feedback-foreground-colours-and-compiled-capture-plan-not-whole-app-accessibility');
  assert.deepEqual(review.captureCases, feedbackTextCases); assert.equal(review.beforeCases, 28); assert.equal(review.beforeFailures, 18);
  assert.equal(review.afterCases, 30); assert.equal(review.afterFailures, 0); assert.equal(review.nativeCapturePlanCompiled, true);
  for (const key of ['nativeLayoutsExecuted', 'physicalDeviceAccepted', 'fullAppAccessibilityAccepted',
    'systemInsetsAccepted', 'screenReaderAccepted', 'backendFlowAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  const totals = {tests: 0, failures: 0, errors: 0, skipped: 0, suites: 0};
  for (const file of readdirSync(resolve(folder, 'after/junit'))) {
    assert.match(file, /^TEST-.+\.xml$/);
    const suite = parser.parse(readFileSync(resolve(folder, 'after/junit', file))).testsuite;
    for (const key of ['tests', 'failures', 'errors', 'skipped']) {const value = Number(suite['@_' + key]);
      assert(Number.isSafeInteger(value)); totals[key] += value;}
    totals.suites++;
  }
  assert.deepEqual(totals, {tests: 820, failures: 0, errors: 0, skipped: 0, suites: 116});
  assert.deepEqual(json('after/all-unit-summary.json'), totals);
  const builds = json('after/compiled-apks.json'); assert.equal(Object.keys(builds).length, 2);
  for (const build of Object.values(builds)) {assert(build.bytes > 1_000_000); assert.match(build.sha256, /^[a-f0-9]{64}$/);}
  assert.match(readFileSync(resolve(folder, 'after/compiled-layout-signature.txt'), 'utf8'), /public final void feedbackTextFitsActualComponents\(\);/);
  assert(stages.after.every(row => Number.isFinite(row.contrastRatio) && row.contrastRatio >= row.minimum));
  const text = stages.after.filter(row => row.minimum === 4.5); assert.equal(text.length, 28);
  return {beforeCases: 28, originalFailures: 18, afterCases: 30, currentFailures: 0,
    minimumTextContrast: Math.min(...text.map(row => row.contrastRatio)), nativeLayoutsExecuted: false, releaseAccepted: false};
}

export function validateFeedbackTextCaptureFiles(directory) {
  const records = [];
  for (const name of feedbackTextCases) {
    const [screen, theme, format] = name.split('-'), marker = JSON.parse(readFileSync(resolve(directory, name + '.json')));
    assert.equal(marker.scope, 'executed-feedback-components-not-full-app-or-physical');
    assert.equal(marker.case, name); assert.equal(marker.screen, screen); assert.equal(marker.dark, theme === 'dark');
    assert.equal(marker.fontScale, 1.3); assert.equal(marker.completed, true);
    for (const key of ['physicalDevice', 'backendCalls', 'mapsRendered', 'productionWrites']) assert.equal(marker[key], false, key);
    const [width, height, density] = format === 'phone' ? [320, 700, 3] : [900, 600, 1];
    assert.deepEqual([marker.widthDp, marker.heightDp, marker.density], [width, height, density]);
    assert(Number.isSafeInteger(marker.capturedAtEpochMillis) && marker.capturedAtEpochMillis > 0);
    const dimensions = file => {const bytes = readFileSync(resolve(directory, file)); assert(bytes.length > 1024);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(sha(bytes), file.endsWith('-window.png') ? marker.windowSha256 : marker.viewportSha256);
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];};
    assert.deepEqual(dimensions(name + '.png'), [width * density, height * density]);
    const [windowWidth, windowHeight] = dimensions(name + '-window.png');
    assert(windowWidth >= width * density && windowHeight >= height * density);
    records.push(marker);
  }
  return {scope: 'feedback-capture-integrity-not-visual-or-physical-flow-acceptance', records};
}
