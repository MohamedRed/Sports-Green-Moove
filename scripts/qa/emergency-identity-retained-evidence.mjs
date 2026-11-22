import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emergencyIdentityUiImages, validateEmergencyIdentityDevice } from './emergency-identity-ui-evidence.mjs';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const emergencyIdentityScope = 'local-recreated-child-contact-ui-not-own-child-account';
export function validateEmergencyIdentityReport(report) {
  assert.equal(report.scope, emergencyIdentityScope); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1);
  assert.deepEqual(report.steps, [{ id: 'recreated-child-emergency-contact-ui', status: 'passed' }]);
  assert.equal(report.primaryEvidencePhase, 'emergency-identity');
  for (const key of ['nativeUiExecuted', 'adminClientClosed', 'localPackagesRemoved', 'isolatedEnvironmentDestroyed',
    'emulatorCliExitedSuccessfully']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'productionWrites', 'safetyAuditAccepted', 'storeReviewAccepted',
    'childOwnAccountDialImplemented', 'fullProcessRestartProven']) assert.equal(report[key], false, key);
  for (const key of ['dialIntentCount', 'directCallIntentCount', 'providerRequests']) assert.equal(report[key], 0, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.deepEqual(report.fixtureIsolation, { baselineRecordsPreserved: true, claimsUnchanged: true,
    baselineCollectionCount: 15, contactCount: 2, contactOperationCount: 2, guardianEventCount: 5, oldContactPreserved: true });
  assert(Object.keys(report.sourceFiles).length >= 30);
}
export function validateRetainedEmergencyIdentity(root, source) {
  const directory = dirname(resolve(root, source)), read = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source))); validateEmergencyIdentityReport(report);
  const marker = json('emergency-identity-device.json'), pull = json('adb-pull-emergency-identity.json');
  validateEmergencyIdentityDevice(marker, pull, report.runId, read);
  for (const [key, value] of Object.entries(marker)) assert.deepEqual(report[key], value);
  const { isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app } = report;
  assert.deepEqual(json('emergency-identity-app-results.json'), app);
  const transcript = read('LocalEmergencyIdentityFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), report.transcriptSha256);
  validateContinuousDeviceEvidence({ setup: json('disposable-device-setup.json'),
    setupBytes: read('disposable-device-setup.json'), restored: json('disposable-device-restore.json'),
    claimed: read('disposable-device-setup.json.claimed'), report });
  const context = JSON.parse(readFileSync(resolve(directory, '../retained-context.json')));
  assert.equal(context.cases['emergency-identity'].runId, report.runId);
  assert.equal(context.childOwnAccountVerified, false); assert.equal(context.physicalDevice, false);
  assert.deepEqual(context.reviewedCaptures, emergencyIdentityUiImages.map((file) => 'emergency-identity/' + file));
  assertRetainedSourceFiles(root, report.sourceFiles);
  return report;
}
