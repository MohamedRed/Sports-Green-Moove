import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const formFeedbackFolder = 'docs/release/evidence/form-feedback-contrast-2026-11-03/';
export const formFeedbackStates = ['auth', 'search', 'chat-error', 'chat-limit', 'chat-sending'];
export const formFeedbackCases = formFeedbackStates.flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));

export function validateFormFeedbackUnits(root) {
  const folder = resolve(root, formFeedbackFolder), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)), parser = new XMLParser({ignoreAttributes: false});
  assertEvidenceBundleChecksums(folder);
  const sources = {}, measurements = {};
  const unitNames = ['light', 'dark'].flatMap(theme => formFeedbackStates.map(state => `${theme}-${state}`));
  for (const [stage, failed] of [['before', 5], ['after', 0]]) {
    sources[stage] = json(stage + '/source-files.json'); assertRetainedSourceFiles(root, sources[stage]);
    const suite = parser.parse(read(stage + '/contrast-' + (failed ? 'failed' : 'passed') + '.xml')).testsuite;
    assert.deepEqual(['tests', 'failures', 'errors', 'skipped'].map(key => suite['@_' + key]), ['10', String(failed), '0', '0']);
    assert.deepEqual(suite.testcase.map(row => row['@_name']).sort(), unitNames.map(name => `formFeedbackRemainsReadable[${name}]`).sort());
    assert(suite.testcase.every(row => !Object.hasOwn(row, 'skipped') && !Object.hasOwn(row, 'error')));
    const rejected = suite.testcase.filter(row => Object.hasOwn(row, 'failure'));
    assert.equal(rejected.length, failed); assert(rejected.every(row => row['@_name'].includes('[light-')));
    measurements[stage] = suite['system-out'].trim().split('\n').map(row => JSON.parse(row));
    assert.deepEqual(measurements[stage], json(stage + '/measurements.json'));
    assert.deepEqual(measurements[stage].map(row => row.case), unitNames);
    assert(measurements[stage].every(row => row.minimum === 4.5 && Number.isFinite(row.contrastRatio)));
    assert.equal(measurements[stage].filter(row => row.contrastRatio < row.minimum).length, failed);
  }
  const archived = (stage, file) => readFileSync(resolve(root, 'docs/release/evidence/source-archive', sources[stage][file] + '.txt'), 'utf8');
  const main = 'android/app/src/main/java/be/sportgreenmoove/app/';
  for (const file of ['ui/OnboardingScreen.kt', 'ui/SearchScreen.kt', 'ui/ConversationMessageUi.kt']) {
    let current = archived('after', main + file);
    if (file.endsWith('ConversationMessageUi.kt')) current = current.replace(
      'if (validLength && sending) Sgm.colors.textSecondary else Sgm.colors.textError', 'SgmColor.Orange');
    else current = current.replaceAll('Sgm.colors.textError', 'SgmColor.Orange');
    if (file.endsWith('SearchScreen.kt')) current = current.replace('import be.sportgreenmoove.app.design.Sgm\n',
      'import be.sportgreenmoove.app.design.Sgm\nimport be.sportgreenmoove.app.design.SgmColor\n');
    assert.equal(current, archived('before', main + file), 'Only feedback foregrounds and an unused import may change');
  }
  assert.equal(sources.before[main + 'design/SgmColors.kt'], sources.after[main + 'design/SgmColors.kt']);
  const unit = 'android/app/src/test/java/be/sportgreenmoove/app/design/SgmFormFeedbackContrastTest.kt';
  assert.equal(archived('after', unit)
    .replace('                    val foreground = if (state == "chat-sending") palette.textSecondary else palette.textError\n', '')
    .replace('foreground.toArgb()', 'SgmColor.Orange.toArgb()'), archived('before', unit));
  const totals = {tests: 0, failures: 0, errors: 0, skipped: 0, suites: 0};
  for (const file of readdirSync(resolve(folder, 'after/junit'))) {
    assert.match(file, /^TEST-.+\.xml$/);
    const suite = parser.parse(read('after/junit/' + file)).testsuite;
    for (const key of ['tests', 'failures', 'errors', 'skipped']) totals[key] += Number(suite['@_' + key]);
    totals.suites++;
  }
  assert.deepEqual(totals, {tests: 830, failures: 0, errors: 0, skipped: 0, suites: 117});
  assert.deepEqual(json('after/all-unit-summary.json'), totals);
  const builds = json('after/compiled-apks.json'); assert.equal(Object.keys(builds).length, 2);
  for (const build of Object.values(builds)) {assert(build.bytes > 1_000_000); assert.match(build.sha256, /^[a-f0-9]{64}$/);}
  assert.match(read('after/compiled-layout-signature.txt').toString(), /actualFormFeedbackIsCompleteAndReadable\(\);/);
  const review = json('review.json');
  assert.equal(review.scope, 'form-feedback-foregrounds-and-compiled-native-plan-not-rendered-or-flow-proof');
  assert.equal(review.sourceBaseCommit, '09008cb4388a50b937e0eda86c01942cc0590dbd');
  assert.deepEqual([review.beforeCases, review.beforeFailures, review.afterCases, review.afterFailures], [10, 5, 10, 0]);
  assert.deepEqual(review.captureCases, formFeedbackCases); assert.equal(review.nativePlanCompiled, true);
  assert.equal(review.nativeCasesPlanned, 4); assert.equal(review.nativeViewportsPlanned, 20);
  for (const key of ['nativeLayoutsExecuted', 'physicalDeviceAccepted', 'authenticationAccepted', 'searchAccepted',
    'messageDeliveryAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted', 'fallbackAdded', 'deadlineChanged', 'thresholdReduced'])
    assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  return {beforeCases: 10, beforeFailures: 5, afterCases: 10, afterFailures: 0,
    minimumContrast: Math.min(...measurements.after.map(row => row.contrastRatio)), nativeLayoutsExecuted: false, releaseAccepted: false};
}
