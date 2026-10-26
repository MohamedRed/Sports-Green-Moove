import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { validateChildAccountApprovalReport } from './child-account-approval-evidence.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const childDiscoveryFolder = 'docs/release/evidence/child-contact-discovery-2026-10-26/';
export function validateChildDiscoveryReport(report) {
  validateChildAccountApprovalReport(report);
  assert.equal(report.discovery.currentAuthorityPatches, 12);
  for (const key of ['profileIdDiffersFromLogin', 'minimalOwnContactOnly', 'noActiveRideExplicit', 'newestRideSelected',
    'invalidNewestRideDeniedWithoutFallback', 'knownRideRecheckPreserved', 'authenticatedServiceOnly'])
    assert.equal(report.discovery[key], true, key);
  assert.equal(report.isolation.baselineRecordsPreserved, true);
  assert.equal(report.isolation.otherLiveRidesPreserved, true);
}
export function validateChildDiscoveryEvidence(root) {
  const read = file => readFileSync(resolve(root, childDiscoveryFolder, file));
  const report = JSON.parse(read('results.json')); validateChildDiscoveryReport(report);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-26');
  assertRetainedSourceFiles(root, report.sourceFiles);
  const native = JSON.parse(read('android.json'));
  assert.equal(native.scope, 'jvm-and-test-apk-build-not-component-or-phone-execution');
  assert.equal(native.testApkBuildSucceeded, true);
  assert.equal(native.componentExecuted, false); assert.equal(native.physicalDevice, false);
  assertRetainedSourceFiles(root, native.sourceFiles);
  for (const [file, count] of [['ChildRideEmergencyStateTest', 11], ['ChildRideEmergencyWireTest', 4]]) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(file + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  }
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['results.json', 'android.json', 'ChildRideEmergencyStateTest.xml',
    'ChildRideEmergencyWireTest.xml', 'disposal.json'].sort());
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
  const cleanup = JSON.parse(read('disposal.json'));
  assert.equal(cleanup.runId, report.runId); assert.equal(cleanup.trialPassed, true);
  assert.equal(cleanup.isolatedEnvironmentDestroyed, true); assert.equal(cleanup.emulatorEndpoints.closed, true);
}
