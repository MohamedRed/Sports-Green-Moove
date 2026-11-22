import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const [destination] = process.argv.slice(2);
assert(destination?.startsWith('/') && !existsSync(destination)); mkdirSync(destination, {recursive: true});
const write = (file, value) => writeFileSync(resolve(destination, file), JSON.stringify(value, null, 2) + '\n');
for (const [input, output] of [
  ['sgm-ride-payment-preparation-red-20261023.txt', 'red.txt'], ['sgm-payment-fees-final-20261023.txt', 'services.txt'],
  ['sgm-payment-fees-units-20261023.txt', 'units.txt'], ['sgm-payment-fees-build-20261023.txt', 'build.txt'],
  ['sgm-driver-booking-identity-build-20261023.txt', 'native-build.txt'], ['sgm-payment-fees-root-20261023.txt', 'root-tests.txt'],
]) copyFileSync('/private/tmp/' + input, resolve(destination, output));
assert.match(readFileSync(resolve(destination, 'red.txt'), 'utf8'), /9 failed \| 1 passed \(10\)/);
assert.match(readFileSync(resolve(destination, 'services.txt'), 'utf8'), /78 passed \(78\)/);
assert.match(readFileSync(resolve(destination, 'units.txt'), 'utf8'), /434 passed \(434\)/);
const files = ['functions/src/domain/paymentFees.ts', 'functions/src/services/stripeConnect.ts',
  'functions/src/services/ridePaymentPreparation.ts', 'functions/src/services/stripePaymentValidation.ts',
  'functions/src/__tests__/payment-fees.test.ts', 'tests/ride-payment-preparation-flow.test.ts', 'package.json',
  '.github/workflows/web-integration-smoke.yml', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalDriverFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ReservationActionsUiTest.kt'];
const sources = {};
for (const file of files) {
  const bytes = readFileSync(file), target = resolve(destination, 'source', file + '.txt');
  mkdirSync(resolve(target, '..'), {recursive: true}); writeFileSync(target, bytes);
  sources[file] = createHash('sha256').update(bytes).digest('hex');
}
write('source-sha256.json', sources);
const baseline = '412f22f7f00fd836f394b06cf5804ed196bc02f0';
for (const file of ['functions/src/services/ridePaymentPreparation.ts', 'functions/src/services/stripeConnect.ts']) {
  const target = resolve(destination, 'before', file + '.txt'); mkdirSync(resolve(target, '..'), {recursive: true});
  writeFileSync(target, execFileSync('git', ['show', baseline + ':' + file]));
}
write('summary.json', {checkedAt: '2026-10-23', scope: 'isolated-initial-payment-fee-freezing-not-live-provider-or-phone',
  baselineCommit: baseline, sourceWasUncommittedDuringTests: true,
  initialCases: 10, initialFailed: 9, initialPassed: 1, paymentPreparationCasesPassed: 18, financialCasesPassed: 78,
  backendUnitCasesPassed: 434, newFeeUnitCasesPassed: 40, rootCasesPassed: 1850, nativeTestApkCompiled: true,
  nativeApprovalRegressionExecuted: false, providerGatewaySimulated: true,
  realPayments: false, realRefunds: false, physicalPaymentsAccepted: false, productionWrites: false,
  newMediaPublished: false, releaseComplete: false,
  emulatorEndpoints: await assertLocalEndpointsClosed([8080,4400,4500]),
  redScope: 'The initial ten-case file had nine failing new expectations. The later eighteen-case file adds concurrency, retrieval, legacy identity variants and webhook settlement checks; the original red file was not separately frozen.'});
const hashes = {};
function walk(folder = '') {
  for (const entry of readdirSync(resolve(destination, folder), {withFileTypes: true})) {
    const file = folder ? folder + '/' + entry.name : entry.name;
    if (entry.isDirectory()) walk(file); else hashes[file] = createHash('sha256').update(readFileSync(resolve(destination, file))).digest('hex');
  }
}
walk(); write('artifact-sha256.json', hashes);
console.log('Retained isolated payment tests, exact source and build evidence without live-money acceptance.');
