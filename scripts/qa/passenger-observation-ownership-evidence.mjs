import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validatePassengerObservationOwnership(root, record) {
  const base = dirname(resolve(root, record.source)), read = file => readFileSync(resolve(base, file), 'utf8');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = JSON.parse(read('summary.json'));
  assert.equal(record.checkedAt, report.checkedAt);
  assert.equal(report.scope, 'local-passenger-command-observation-ownership-unit-and-apk-build');
  assert.equal(report.baselineCommit, '7c7bb699dfd59b5a66ef1a7656296da26c9bdddc');
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'releaseComplete',
    'ciFailureCauseProven', 'completionRulesChanged', 'applicationDeployed']) assert.equal(report[key], false, key);
  assert.equal(report.competingPassengerReadRemoved, true); assert.equal(report.nativeTestApkCompiled, true);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });
  const suite = file => parser.parse(read(file)).testsuite;
  const red = suite('red/unit-results.xml');
  assert.equal(red.tests, 2); assert.equal(red.failures, 2); assert.equal(red.errors, 0); assert.equal(red.skipped, 0);
  for (const item of red.testcase) {
    assert.match(item.failure.message, /The age ticker must not undo a passenger command/);
    assert.match(item.failure.message, /but was:.*(?:pickupStatus|dropoffStatus)=pending/);
  }
  assert.match(read('red/gradle-transcript.txt'), /2 tests completed, 2 failed/);
  assert.match(read('red/ride-actions-source.kt.txt'), /setActiveRide\(providers.firebase.getActiveRide\(\)\)/);
  const counts = directory => readdirSync(resolve(base, directory)).filter(file => file.endsWith('.xml')).map(file => {
    const row = suite(directory + '/' + file);
    assert.equal(row.failures, 0); assert.equal(row.errors, 0); assert.equal(row.skipped, 0);
    return row.tests;
  });
  assert.equal(counts('green').reduce((a, b) => a + b, 0), 17);
  const full = counts('full'); assert.equal(full.length, 78); assert.equal(full.reduce((a, b) => a + b, 0), 497);
  assert.deepEqual(report.targeted, { tests: 17, failures: 0, skipped: 0 });
  assert.deepEqual(report.fullUnit, { suites: 78, tests: 497, failures: 0, skipped: 0 });
  for (const directory of ['green', 'full']) {
    const log = read(directory + '/gradle-transcript.txt'); assert.match(log, /BUILD SUCCESSFUL/);
    assert.doesNotMatch(log, /BUILD FAILED/);
  }
  assert.match(read('full/gradle-transcript.txt'), /:app:assembleDebugAndroidTest/);
  assertEvidenceBundleChecksums(base); assertRetainedSourceFiles(root, report.sourceFiles);
  return report;
}
