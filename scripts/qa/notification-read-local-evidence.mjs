import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNotificationReadLocal(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const report = json('summary.json'); assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'local-notification-acknowledgement-services-and-state-not-connected-ui');
  assert.equal(report.sourceCommit, 'b0677594a01d754b1b7cd18559c7639e5bdf50c5');
  const services = json('service-tests.json'); assert.equal(services.success, true);
  for (const key of ['numTotalTests', 'numPassedTests']) assert.equal(services[key], 19);
  for (const key of ['numFailedTests', 'numPendingTests', 'numFailedTestSuites']) assert.equal(services[key], 0);
  assert.equal(report.serviceTestsPassed, 19);
  const parser = new XMLParser({ignoreAttributes: false});
  const suites = readdirSync(resolve(base, 'unit')).map(file => parser.parse(bytes('unit/' + file)).testsuite);
  assert.equal(suites.length, 2); assert.equal(suites.reduce((n, suite) => n + Number(suite['@_tests']), 0), 10);
  assert(suites.every(suite => ['@_failures', '@_errors', '@_skipped'].every(key => suite[key] === '0')));
  assert.equal(report.nativeStateTestsPassed, 10); assert.equal(report.rootTestsPassed, 1798);
  assert.match(bytes('root-tests.tap').toString(), /# tests 1798\r?\n# suites 0\r?\n# pass 1798\r?\n# fail 0/);
  assert.match(bytes('native-build.log').toString(), /BUILD SUCCESSFUL/); assert.equal(report.uiTestApkBuilt, true); assert.equal(report.uiTestsPrepared, 3);
  for (const key of ['nativeUiExecuted', 'phoneTrialCompleted', 'pushDeliveryAccepted', 'iosAccepted', 'productionDeployed', 'productionWrites', 'releaseComplete']) assert.equal(report[key], false);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 32);
  for (const [file, sha] of Object.entries(sources)) {
    assert(!file.includes('..') && !file.startsWith('/'));
    assert.equal(createHash('sha256').update(bytes('source/' + file + '.txt')).digest('hex'), sha);
  }
  assertEvidenceBundleChecksums(base);
  return report;
}
