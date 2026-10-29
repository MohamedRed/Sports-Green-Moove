import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const reviewContextFolder = 'docs/release/evidence/review-trip-context-2026-10-29/';
export const reviewContextCaptures = ['choices', 'large-text', 'unavailable'];
export function assertReviewContextEvidence({summary, service, units, device, disposal}) {
  assert.equal(summary.scope, 'isolated-review-trip-context-services-and-native-components-not-end-to-end-phone');
  assert.equal(summary.baselineCommit, '7e0e22ed7b5c6b207085e942c47d3d3ad48a8d2f');
  assert.equal(summary.implementationWasUncommittedAtBuild, true);
  assert.equal(summary.nativeComponentCases, 9); assert.equal(summary.newNativeComponentCases, 3);
  assert.equal(summary.backendUnitCases, 538); assert.equal(summary.syntheticContentOnly, true);
  for (const key of ['physicalDeviceTested', 'nativeServiceIntegrationVerified', 'processRestartProven',
    'realNetworkLossVerified', 'fullNativeGatePassedForThisImplementation', 'productionDeployed', 'productionWrites',
    'realPayments', 'iosUiExecuted', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(summary.providerRequests, 0);
  assert.equal(service.scope, 'authenticated-isolated-review-trip-context-not-phone-or-production');
  assert.equal(service.completed, true); assert.equal(service.projectId, 'demo-sgm-local-qa');
  assert.equal(service.steps.length, 7); assert(service.steps.every(row => row.status === 'passed'));
  assert.equal(service.protectedRecordCount, 158);
  assert.deepEqual(service.observations, {firstPage: {reviews: 20, currentContextCount: 20},
    pagination: {accounts: 2, pagesPerAccount: 2, contextualRequestsPerAccount: 25, unavailableRequestsPerAccount: 7},
    submission: {score: 5, parentRemaining: 31, driverUnchanged: true, ratingCount: 1}});
  for (const key of ['adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed']) assert.equal(service[key], true, key);
  assert.equal(service.productionWrites, false); assert.equal(service.phoneUiExecuted, false); assert.equal(service.providerRequests, 0);
  assert.equal(service.emulatorEndpoints.closed, true);
  assert.deepEqual(units, {tests: 636, failures: 0, errors: 0, skipped: 0});
  assert.equal(device.serial, 'emulator-5582'); assert.equal(device.records.length, 2);
  assert.deepEqual(device.records.map(row => row.packageName), ['be.sportgreenmoove.app.local', 'be.sportgreenmoove.app.local.test']);
  for (const row of device.records) {assert.equal(row.installedBytesVerified, true); assert.match(row.sha256, /^[a-f0-9]{64}$/);}
  assert.deepEqual(Object.keys(device.captures).sort(), reviewContextCaptures.map(name => 'review-trip-context-' + name + '.png').sort());
  for (const key of ['ownedEmulatorProcessAbsent', 'ownedAdbProcessAbsent', 'noLocalRuntimeDirectories']) assert.equal(disposal[key], true, key);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 45690, 45691, 5582, 5037].map(port => ({port, available: true})));
  return summary;
}
export function validateReviewContextEvidence(root, reference = {source: reviewContextFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewContextFolder + 'summary.json');
  const base = resolve(root, reviewContextFolder), json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
  const text = file => readFileSync(resolve(base, file), 'utf8');
  assertEvidenceBundleChecksums(base);
  const service = json('service'), device = json('device-copy');
  const summary = assertReviewContextEvidence({summary: json('summary'), service, units: json('android-unit-counts'), device, disposal: json('disposal')});
  assertRetainedSourceFiles(root, service.sourceFiles); assertRetainedSourceFiles(root, json('native-sources'));
  for (const file of ['preparation-first.txt', 'preparation-second.txt']) assert.match(text(file), /supports Java version before 21/);
  assert.match(text('compile-preparation.txt'), /Syntax error: Unexpected tokens/);
  assert.match(text('android-build.txt'), /BUILD SUCCESSFUL/); assert.match(text('backend-units.txt'), /538 passed \(538\)/);
  assert.match(text('components-verified.txt'), /OK \(9 tests\)/); assert.match(text('components-verified.txt'), /INSTRUMENTATION_CODE: -1/);
  assert.match(text('ios-checks.txt'), /PendingReviewChecks passed/);
  assert.equal(json('ios-booking-recovery').passed, true); assert.equal(json('ios-booking-recovery').separateProcessRecovery, true);
  for (const [file, hash] of Object.entries(device.captures)) {
    const bytes = readFileSync(resolve(base, file)); assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
    const info = imageSize(bytes); assert.equal(info.type, 'png'); assert(info.width >= 700 && info.height >= 400);
  }
  return summary;
}
