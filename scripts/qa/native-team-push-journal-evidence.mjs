import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {nativeTeamPushSources, nativeTeamPushCases} from './native-team-push-sources.mjs';

export const nativeTeamPushFolder = 'docs/release/evidence/native-team-push-journal-2026-11-01/';
export function validateNativeTeamPushJournal(root, folder = nativeTeamPushFolder) {
  const base = resolve(root, folder), read = file => readFileSync(resolve(base, file), 'utf8');
  assertEvidenceBundleChecksums(base); const run = JSON.parse(read('review.json'));
  assert.equal(run.scope, 'native-registration-journal-jvm-and-build-only');
  assert.equal(run.testedAt.slice(0, 10), '2026-11-01'); assert(run.startedAt <= run.testedAt);
  for (const key of ['sourceUnchangedDuringBuild', 'appCompiled', 'instrumentationCompiled']) assert.equal(run[key], true, key);
  for (const key of ['instrumentationExecuted', 'nativeLifecycleImplemented', 'realPhoneTokenRegistered', 'dispatcherImplemented',
    'pushDeliveryVerified', 'tapNavigationVerified', 'physicalDevice', 'productionWrites', 'releaseAccepted']) assert.equal(run[key], false, key);
  assert.equal(run.providerSends, 0); assert.equal(run.mapRequests, 0);
  assert.equal(run.unitTests, 722); assert.equal(run.focusedUnitTests, 27); assert.deepEqual(run.focusedSuites, nativeTeamPushCases);
  assert.deepEqual(Object.keys(run.sourceFiles).sort(), [...nativeTeamPushSources].sort());
  assertRetainedSourceFiles(root, run.sourceFiles);
  const parser = new XMLParser({ignoreAttributes: false}), files = readdirSync(resolve(base, 'junit'));
  assert.equal(files.length, run.unitSuites); const suites = [];
  for (const file of files) {
    const suite = parser.parse(read('junit/' + file)).testsuite;
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    assert.equal(suite['@_hostname'], 'local-test-host');
    const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
    assert.equal(cases.length, Number(suite['@_tests']));
    for (const row of cases) assert(!('failure' in row || 'error' in row || 'skipped' in row));
    suites.push(suite);
  }
  assert.equal(suites.reduce((total, suite) => total + Number(suite['@_tests']), 0), run.unitTests);
  for (const [name, count] of Object.entries(nativeTeamPushCases))
    assert.equal(Number(suites.find(suite => suite['@_name'] === 'be.sportgreenmoove.app.services.' + name)?.['@_tests']), count);
  for (const apk of [run.apk, run.testApk]) { assert.match(apk.sha256, /^[a-f0-9]{64}$/); assert(apk.bytes > 0); }
  const log = read('build-success.txt'); assert(log.includes('BUILD SUCCESSFUL'));
  for (const task of ['testDebugUnitTest', 'assembleDebug', 'assembleDebugAndroidTest']) assert(log.includes(':app:' + task));
  return run;
}
