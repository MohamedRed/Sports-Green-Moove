import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {nativeTeamPushSignOutSources, nativeTeamPushSignOutCases, nativeTeamPushSuiteName} from './native-team-push-sources.mjs';

export const nativeTeamPushSignOutFolder = 'docs/release/evidence/native-team-push-signout-2026-11-01/';
export function validateNativeTeamPushSignOut(root, folder = nativeTeamPushSignOutFolder) {
  const base = resolve(root, folder), read = file => readFileSync(resolve(base, file), 'utf8');
  assertEvidenceBundleChecksums(base); const run = JSON.parse(read('review.json'));
  assert.equal(run.scope, 'native-signout-ordering-and-durable-intent-jvm-and-build-only');
  assert.equal(run.testedAt.slice(0, 10), '2026-11-01'); assert(run.startedAt <= run.testedAt);
  for (const key of ['sourceUnchangedDuringBuild', 'appCompiled', 'instrumentationCompiled', 'nativeLifecycleImplemented',
    'isolatedBuild', 'authenticatedRemovalModelVerified', 'restartIntentModelVerified', 'explicitSignInRequired', 'syntheticTokenConnectedContractCompiled'])
    assert.equal(run[key], true, key);
  for (const key of ['instrumentationExecuted', 'realSdkCallsExecuted', 'runtimeCallbacksExecuted', 'authenticatedSignoutRemovalVerified',
    'realPhoneTokenRegistered', 'dispatcherImplemented', 'pushDeliveryVerified', 'tapNavigationVerified', 'automaticRetry',
    'physicalDevice', 'productionWrites', 'releaseAccepted', 'signOutUiCasesExecuted', 'syntheticTokenConnectedContractExecuted'])
    assert.equal(run[key], false, key);
  assert.equal(run.providerSends, 0); assert.equal(run.mapRequests, 0); assert.equal(run.messagingSdkVersion, '25.0.2');
  assert.equal(run.signOutIntentSchemaVersion, 2); assert.equal(run.signOutUiCasesCompiled, 3);
  assert.equal(run.unitTests, 770); assert.equal(run.unitSuites, 113); assert.equal(run.focusedUnitTests, 79);
  assert.deepEqual(run.focusedSuites, nativeTeamPushSignOutCases);
  assert.deepEqual(Object.keys(run.sourceFiles).sort(), [...nativeTeamPushSignOutSources].sort()); assertRetainedSourceFiles(root, run.sourceFiles);
  const parser = new XMLParser({ignoreAttributes: false}), files = readdirSync(resolve(base, 'junit')); assert.equal(files.length, run.unitSuites);
  const suites = files.map(file => parser.parse(read('junit/' + file)).testsuite);
  for (const suite of suites) {
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    assert.equal(suite['@_hostname'], 'local-test-host');
    const cases = [suite.testcase].flat(); assert.equal(cases.length, Number(suite['@_tests']));
    for (const row of cases) assert(!('failure' in row || 'error' in row || 'skipped' in row));
  }
  assert.equal(suites.reduce((sum, row) => sum + Number(row['@_tests']), 0), run.unitTests);
  for (const [name, count] of Object.entries(nativeTeamPushSignOutCases))
    assert.equal(Number(suites.find(row => row['@_name'] === nativeTeamPushSuiteName(name))?.['@_tests']), count);
  assert.deepEqual(JSON.parse(read('registration-manifest.json')), {applicationClass: 'be.sportgreenmoove.app.SgmApplication',
    autoInit: false, delegation: false, service: {name: 'be.sportgreenmoove.app.services.TeamPushMessagingService', enabled: false, exported: false}});
  for (const apk of [run.apk, run.testApk]) { assert.match(apk.sha256, /^[a-f0-9]{64}$/); assert(apk.bytes > 0); }
  const log = read('build-success.txt'); assert(log.includes('BUILD SUCCESSFUL'));
  for (const task of ['testDebugUnitTest', 'assembleDebug', 'assembleDebugAndroidTest', 'dependencyInsight']) assert(log.includes(':app:' + task));
  return run;
}
