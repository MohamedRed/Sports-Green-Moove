import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {feedbackTextCases, feedbackTextFolder} from './feedback-text-evidence.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, feedbackTextFolder);
assert(existsSync(resolve(folder, 'before/contrast-failed.xml'))); assert(!existsSync(resolve(folder, 'after')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => {const path = resolve(folder, file); mkdirSync(resolve(path, '..'), {recursive: true});
  writeFileSync(path, Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});};
const source = file => {const bytes = readFileSync(resolve(root, file)), hash = sha(bytes);
  const archive = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (existsSync(archive)) assert(readFileSync(archive).equals(bytes)); else writeFileSync(archive, bytes, {flag: 'wx'});
  return hash;};
const paths = ['design/SgmColors.kt', 'design/SgmTheme.kt', 'ui/RuntimeNotice.kt', 'ui/RideMonitorScreen.kt',
  'ui/TripsActiveRideCard.kt', 'ui/ReviewCard.kt'].map(file => 'android/app/src/main/java/be/sportgreenmoove/app/' + file);
paths.push('android/app/src/test/java/be/sportgreenmoove/app/design/SgmFeedbackContrastTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextCapture.kt',
  'scripts/run-android-ui-tests-and-collect-screenshots.sh');
write('after/source-files.json', Object.fromEntries(paths.map(file => [file, source(file)])));
const parser = new XMLParser({ignoreAttributes: false}), resultFolder = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
const totals = {tests: 0, failures: 0, errors: 0, skipped: 0, suites: 0};
for (const file of readdirSync(resultFolder).filter(file => /^TEST-.+\.xml$/.test(file)).sort()) {
  const bytes = readFileSync(resolve(resultFolder, file)), suite = parser.parse(bytes).testsuite;
  for (const key of ['tests', 'failures', 'errors', 'skipped']) {const value = Number(suite['@_' + key]); assert(Number.isSafeInteger(value)); totals[key] += value;}
  totals.suites++; write('after/junit/' + file, bytes);
  if (file.endsWith('.SgmFeedbackContrastTest.xml')) {
    assert.equal(suite['@_tests'], '30'); assert.equal(suite['@_failures'], '0');
    write('after/contrast-passed.xml', bytes);
    write('after/measurements.json', suite['system-out'].trim().split('\n').map(line => JSON.parse(line)));
  }
}
assert(totals.tests > 800); assert.equal(totals.failures + totals.errors + totals.skipped, 0);
write('after/all-unit-summary.json', totals);
const builds = {};
for (const path of ['android/app/build/outputs/apk/debug/app-debug.apk',
  'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk']) {
  const bytes = readFileSync(resolve(root, path)); builds[path] = {bytes: bytes.length, sha256: sha(bytes)};
}
const signature = execFileSync('javap', ['-p', resolve(root,
  'android/app/build/tmp/kotlin-classes/debugAndroidTest/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.class')], {encoding: 'utf8'});
assert(signature.includes('public final void feedbackTextFitsActualComponents();'));
write('after/compiled-layout-signature.txt', Buffer.from(signature)); write('after/compiled-apks.json', builds);
write('review.json', {scope: 'feedback-foreground-colours-and-compiled-capture-plan-not-whole-app-accessibility',
  workingTreeGitHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  beforeCases: 28, beforeFailures: 18, afterCases: 30, afterFailures: 0, captureCases: feedbackTextCases,
  nativeCapturePlanCompiled: true, nativeLayoutsExecuted: false, physicalDeviceAccepted: false,
  fullAppAccessibilityAccepted: false, systemInsetsAccepted: false, screenReaderAccepted: false,
  backendFlowAccepted: false, releaseAccepted: false, publishedMedia: []});
const files = readdirSync(folder, {recursive: true, withFileTypes: true}).filter(row => row.isFile());
write('artifact-sha256.json', Object.fromEntries(files.map(row => {const path = resolve(row.parentPath, row.name);
  return [path.slice(folder.length + 1), sha(readFileSync(path))];})));
console.log(JSON.stringify({units: totals, compiledCaptureCases: feedbackTextCases.length, nativeLayoutsExecuted: false}));
