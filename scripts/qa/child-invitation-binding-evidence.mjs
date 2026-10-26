import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const childBindingFolder = 'docs/release/evidence/child-invitation-2026-10-26/binding-recheck/';
export function validateChildBindingReport(report) {
  assert.equal(report.scope, 'isolated-child-binding-and-role-fault-reproductions-plus-repair-not-phone-or-production');
  assert.deepEqual([report.serviceGroups, report.backendUnitCases, report.additionalNativeAuthUnitCases, report.rulesCases], [18, 16, 6, 208]);
  for (const key of ['bindingBypassObserved', 'defaultParentPromotionObserved', 'physicalDevice', 'nativeUiExecuted', 'productionWrites', 'releaseAccepted'])
    assert.equal(report[key], false, key);
}
export function validateChildInvitationBindingEvidence(root) {
  const read = path => readFileSync(resolve(root, childBindingFolder, path));
  const report = JSON.parse(read('verification.json')); validateChildBindingReport(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const red = JSON.parse(read('binding-red.json')), roleRed = JSON.parse(read('role-red.json')), green = JSON.parse(read('services.json'));
  assertRetainedSourceFiles(root, red.sourceFiles); assertRetainedSourceFiles(root, roleRed.sourceFiles);
  assert.equal(red.testCount, 13); assert.equal(red.bindingBypassObserved, true);
  assert.equal(roleRed.testCount, 8); assert.equal(roleRed.defaultParentPromotionObserved, true);
  assert.equal(green.testCount, 18); assert.equal(green.steps.length, 18);
  assert(green.steps.every(step => step.status === 'passed')); assert.equal(green.bindingBypassObserved, false);
  assert.equal(green.defaultParentPromotionObserved, false); assert.equal(green.productionWrites, false);
  assert.equal(green.physicalDevice, false); assert.equal(green.providerRequests, 0); assert.equal(green.adminClientClosed, true);
  assert.equal(green.isolatedEnvironmentDestroyed, true); assert.equal(green.emulatorCliExitedSuccessfully, true);
  for (const [path, hash] of Object.entries(green.sourceFiles)) assert.equal(report.sourceFiles[path], hash);
  for (const [path, run, passed] of [['binding-red-disposal.json', red, false], ['role-red-disposal.json', roleRed, false], ['disposal.json', green, true]]) {
    const receipt = JSON.parse(read(path)); assert.equal(receipt.runId, run.runId); assert.equal(receipt.trialPassed, passed);
    assert.equal(receipt.isolatedEnvironmentDestroyed, true);
    assert.deepEqual(receipt.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  }
  const units = JSON.parse(read('functions-units.json'));
  assert.equal(units.success, true); assert.equal(units.numTotalTests, 16); assert.equal(units.numPassedTests, 16);
  assert.equal(units.numFailedTests, 0); assert.equal(units.testResults.length, 3);
  assert(units.testResults.every(file => file.status === 'passed' && file.assertionResults.every(row => row.status === 'passed')));
  const native = new XMLParser({ ignoreAttributes: false }).parse(read('native-auth-units.xml').toString()).testsuite;
  assert.equal(native['@_name'], 'be.sportgreenmoove.app.services.InitializedAuthProfileWireTest');
  assert.deepEqual(['tests', 'failures', 'errors', 'skipped'].map(key => Number(native['@_' + key])), [6, 0, 0, 0]);
  assert.equal(native.testcase.length, 6); assert(read('rules-output.txt').toString().includes('208 passed (208)'));
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['binding-red.json', 'binding-red-disposal.json', 'role-red.json', 'role-red-disposal.json',
    'services.json', 'disposal.json', 'functions-units.json', 'native-auth-units.xml', 'rules-output.txt', 'verification.json'].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash);
}
