import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { validatePaymentFeeEvidence } from './payment-fee-evidence.mjs';

export function validatePayoutAccountingEvidence(root, content) {
  const flow = content.flows.find(item => item.id === 'payments');
  validatePaymentFeeEvidence(root, flow.feeEvidence);
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-18');
  assert.equal(flow.accountingEvidence.checkedAt, '2026-10-23');
  const folder = dirname(resolve(root, flow.accountingEvidence.source));
  const read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file));
  const summary = json('summary.json');
  assert.equal(summary.scope, 'isolated-payout-accounting-not-real-money-or-phone');
  assert.equal(summary.checkedAt, flow.accountingEvidence.checkedAt);
  for (const field of ['realTransfers', 'productionWrites', 'browserToProviderIntegration', 'nativeOrPhysicalPaymentsAccepted', 'releaseComplete'])
    assert.equal(summary[field], false);
  const red = json('red-regressions.json'), green = json('green-financial.json'), functions = json('green-functions.json');
  assert.equal(red.numFailedTests, 2); assert.equal(red.numPassedTests, 0);
  assert.equal(green.numPassedTests, 60); assert.equal(functions.numPassedTests, 394);
  for (const run of [green, functions]) {
    assert.equal(run.success, true); assert.equal(run.numFailedTestSuites, 0);
    assert.equal(run.numFailedTests, 0); assert.equal(run.numPendingTests, 0);
  }
  assert.equal(summary.regressionFailuresBefore, 2); assert.equal(summary.financialCasesPassed, green.numPassedTests);
  assert.equal(summary.backendUnitCasesPassed, functions.numPassedTests);
  const assertions = green.testResults.flatMap(result => result.assertionResults);
  for (const failed of red.testResults.flatMap(result => result.assertionResults)) {
    assert.equal(failed.status, 'failed'); assert(failed.failureMessages.length);
    assert.equal(assertions.find(item => item.fullName === failed.fullName)?.status, 'passed');
  }
  const component = json('component/results.json');
  assert.equal(component.scope, 'local-management-component-simulated-gateway-not-payout-or-phone');
  assert.equal(component.steps.length, 5); assert(component.steps.every(step => step.status === 'passed'));
  assert.equal(summary.browserComponentChecksPassed, 5); assert.equal(component.externalRequests, 0);
  assert.equal(component.realTransfers, false); assert.equal(component.nativeOrPhysicalPhone, false);
  assert.deepEqual(component.viewports, [1440, 768, 390, 320]);
  const rootReport = read('root-node.tap').toString();
  assert.match(rootReport, /# fail 0\n/); assert.match(rootReport, /# cancelled 0\n/);
  assert.equal(summary.rootNodeCasesPassed, Number(/# pass (\d+)/.exec(rootReport)[1]));
  const native = json('native-run.json');
  assert.equal(native.databaseId, 39988296119); assert.equal(native.headSha, 'c1d2a2ff017b89fe498b2537854dc5a64e6d4a0c');
  assert.equal(native.status, 'completed'); assert.equal(native.conclusion, 'failure');
  const focused = native.jobs.filter(job => job.name.startsWith('Android focused safety UI tests / Isolated ')
    && !job.name.endsWith('safety flows'));
  assert.equal(focused.filter(job => job.conclusion === 'success').length, 9);
  assert.equal(focused.filter(job => job.conclusion === 'failure').length, 1);
  assert.equal(native.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  assert.match(read('native-team-instrumentation.txt').toString(), /LocalTeamChatUi\.login/);
  assert.match(read('native-full-failure-excerpt.txt').toString(), /LocalGuardianVerificationFlowTest\.login/);
  assert.equal(json('native-team-restoration.json').verified, true);
  assert.equal(summary.latestNativeRun.rootCauseEstablished, false);
  assert(content.updates.some(item => item.source === flow.accountingEvidence.source.replace('summary.json', 'README.md')),
    'The dated accounting and failed-run history must remain available');
  for (const [file, expected] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(read('source/' + file + '.txt')).digest('hex'), expected, file);
  for (const [file, expected] of Object.entries(json('artifact-sha256.json'))) {
    assert(resolve(folder, file).startsWith(folder + sep));
    assert(!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file), 'Retained test sources must not become executable suites');
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected, file);
  }
  return summary;
}
