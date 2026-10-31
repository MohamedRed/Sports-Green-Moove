import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateDriverConnectEvidence(root, source) {
  const base = dirname(resolve(root, source)), read = name => readFileSync(resolve(base, name), 'utf8');
  const json = name => JSON.parse(read(name)), summary = json('summary.json');
  assert.equal(summary.scope, 'android-connect-coordinator-and-compose-not-real-onboarding');
  assert.equal(summary.checkedAt, summary.testedAt.slice(0, 10));
  assert.equal(summary.coordinatorUnitCases, 11); assert.equal(summary.paymentRegressionCases, 8);
  assert.equal(summary.componentCases, 4); assert.equal(summary.originalComponentCases, 3);
  for (const key of ['sameOriginalComponentFile', 'visualClippingRetained', 'modifiedSourcesArchived', 'precompiledTestPackages']) assert.equal(summary[key], true);
  for (const key of ['physicalDevice', 'realOnboarding', 'productionWrites', 'productionDeployed', 'iosTested', 'realPayment', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(summary.providerRequests, 0); assert.equal(summary.backendRequests, 0);
  const reports = Object.fromEntries(['red', 'green', 'startup-failure', 'startup-failure-2', 'layout'].map(phase => [phase, json(phase + '/results.json')]));
  for (const [phase, report] of Object.entries(reports)) {
    assert.equal(report.scope, 'android-compose-connect-components-no-backend-or-provider');
    assert.equal(report.expectedCases, phase === 'layout' ? 4 : 3); assert.equal(report.packagesRemoved, true);
    for (const key of ['physicalDevice', 'realOnboarding', 'productionWrites', 'administrationUsed']) assert.equal(report[key], false);
    assert.equal(report.providerRequests, 0); assert.equal(report.backendRequests, 0);
    assertRetainedSourceFiles(root, report.sourceFiles);
  }
  assert.equal(reports.red.completed, false); assert.equal(reports.green.completed, true); assert.equal(reports.layout.completed, true);
  for (const phase of ['startup-failure', 'startup-failure-2']) {
    assert.equal(reports[phase].completed, false);
    assert.match(read(phase + '/instrumentation.txt'), /shortMsg=Process crashed/);
  }
  assert.equal(summary.componentTestedAt, reports.layout.testedAt);
  const test = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/PaymentsConnectLayoutTest.kt';
  assert.equal(reports.red.sourceFiles[test], reports.green.sourceFiles[test]);
  assert.notEqual(reports.green.sourceFiles[test], reports.layout.sourceFiles[test]);
  assert.match(read('red/instrumentation.txt'), /Failed to assert the following: \(is not enabled\)/);
  assert.match(read('red/instrumentation.txt'), /Tests run: 3,\s+Failures: 1/);
  assert.match(read('startup-failure-2/app-startup-anr.txt'), /art::DexFileLoader::OpenFromZipEntry/);
  assertInstrumentationPassed(read('green/instrumentation.txt'), 3);
  assertInstrumentationPassed(read('layout/instrumentation.txt'), 4);
  const compilation = json('layout/compilation.json'); assert.equal(compilation.mode, 'speed');
  assert.deepEqual(compilation.packages, {'be.sportgreenmoove.app.local': 'Success', 'be.sportgreenmoove.app.local.test': 'Success'});
  const review = json('visual-review.json'); assert.equal(review.originalThreeCaseNarrowAccepted, false);
  assert.equal(review.finalTwoCapturesAccepted, true); assert.equal(review.credentialsVisible, false);
  for (const [name, count] of [['StripeConnectCoordinatorTest', 11], ['RidePaymentCoordinatorTest', 8]]) {
    const suite = new XMLParser({ignoreAttributes: false}).parse(read(`units/TEST-be.sportgreenmoove.app.services.${name}.xml`)).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
    assert.equal(suite.testcase.length, count);
  }
  const units = json('units/run.json'); assert.equal(units.completed, true); assert.equal(units.exitCode, 0);
  assert.equal(summary.testedAt, units.verifiedAt); assert.equal(units.productionWrites, false);
  const counts = {tests: 0, failures: 0, errors: 0, skipped: 0};
  for (const file of readdirSync(resolve(base, 'units/full-suite'))) {
    assert(file.endsWith('.xml'));
    const suite = new XMLParser({ignoreAttributes: false}).parse(read('units/full-suite/' + file)).testsuite;
    for (const key of Object.keys(counts)) counts[key] += Number(suite['@_' + key]);
  }
  assert.deepEqual(counts, {tests: 543, failures: 0, errors: 0, skipped: 0}); assert.deepEqual(units.counts, counts);
  assertRetainedSourceFiles(root, units.sourceFiles);
  assert.equal(json('setup-failure/results.json').completed, false);
  assert.equal(json('setup-failure/setup-cleanup.json').packagesAbsent, true);
  const cleanup = json('host-cleanup.json'); assert.equal(cleanup.ownedPackagesRemoved, true);
  assert.equal(cleanup.emulator5554Absent, true); assert.equal(cleanup.personalDevicesChanged, false);
  assertEvidenceBundleChecksums(base); return summary;
}
