import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validatePaymentFeeEvidence(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.checkedAt, record.checkedAt);
  assert.equal(report.scope, 'isolated-initial-payment-fee-freezing-not-live-provider-or-phone');
  assert.equal(report.baselineCommit, '412f22f7f00fd836f394b06cf5804ed196bc02f0');
  assert.equal(report.initialFailed, 9); assert.equal(report.initialPassed, 1); assert.equal(report.initialCases, 10);
  assert.equal(report.paymentPreparationCasesPassed, 18); assert.equal(report.financialCasesPassed, 78);
  assert.equal(report.backendUnitCasesPassed, 434); assert.equal(report.newFeeUnitCasesPassed, 40); assert.equal(report.rootCasesPassed, 1850);
  assert.equal(report.providerGatewaySimulated, true); assert.equal(report.sourceWasUncommittedDuringTests, true);
  assert.equal(report.nativeTestApkCompiled, true);
  for (const key of ['nativeApprovalRegressionExecuted', 'realPayments', 'realRefunds', 'physicalPaymentsAccepted',
    'productionWrites', 'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  assert.deepEqual(report.emulatorEndpoints, {host: '127.0.0.1', ports: [8080,4400,4500], closed: true});
  assert.match(bytes('red.txt').toString(), /9 failed \| 1 passed \(10\)/);
  assert.match(bytes('services.txt').toString(), /ride-payment-preparation-flow.test.ts \(18 tests\)/);
  assert.match(bytes('services.txt').toString(), /78 passed \(78\)/);
  assert.match(bytes('services.txt').toString(), /Stopping Firestore Emulator/);
  assert.match(bytes('units.txt').toString(), /434 passed \(434\)/);
  assert.match(bytes('native-build.txt').toString(), /BUILD SUCCESSFUL/);
  assert.match(bytes('build.txt').toString(), /tsc -p tsconfig.json/);
  assert.match(bytes('root-tests.txt').toString(), /# pass 1850\r?\n# fail 0/);
  const sources = json('source-sha256.json'); assert.equal(Object.keys(sources).length, 10);
  for (const [file, expected] of Object.entries(sources))
    assert.equal(createHash('sha256').update(bytes('source/' + file + '.txt')).digest('hex'), expected);
  assertEvidenceBundleChecksums(base); return report;
}
