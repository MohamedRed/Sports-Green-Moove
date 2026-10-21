import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';

export const sessionRestorationScope = 'local-session-restoration-ui-not-physical-network-loss';
export const sessionRestorationCaptures = ['error', 'rotated-error', 'recovered', 'restored', 'identity']
  .map(id => `local-session-restoration-${id}.png`);
export const publishedSessionRestorationCaptures = sessionRestorationCaptures.slice(0, 4);
export function validateSessionRestorationReport(report) {
  assert.equal(report.scope, sessionRestorationScope); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/); assert.equal(report.uid, 'sgm-qa-parent');
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 1); assert.equal(report.restorationAttempts, 4);
  assert.deepEqual(report.steps, [{ id: 'session-restoration', status: 'passed' }]);
  assert.equal(report.primaryEvidencePhase, 'session-restoration');
  for (const key of ['initialFailureVisible', 'failureSurvivedRotation', 'explicitRetryRecoveredSameParent',
    'healthyRotationRestoredSameParent', 'profileIdentityVerified', 'orientationRestored', 'parentSignedOut',
    'firestoreClientTerminated', 'completed', 'nativeUiExecuted', 'proxyClosed', 'adminClientClosed',
    'localPackagesRemoved', 'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'realNetworkLossVerified', 'productionWrites', 'safetyAuditAccepted',
    'storeReviewAccepted']) assert.equal(report[key], false, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.deepEqual(report.fixtureIsolation, {
    allTopLevelCollectionsUnchangedExceptParentTimestamp: true, allUserClaimsUnchanged: true, liveTripsUnchanged: true,
    collections: { bookings: 3, chatInboxes: 4, children: 1, clubs: 3, co2Ledger: 1, memberships: 10,
      messages: 121, notifications: 1, reports: 1, rewardLedger: 1, teams: 1, trips: 2, users: 9 }, accountCount: 5,
  });
  assert.deepEqual(Object.keys(report.screenshots).sort(), [...sessionRestorationCaptures].sort());
  assert.equal(Object.keys(report.sourceFiles).length, 27);
  for (const file of ['scripts/qa/local-session-restoration-ui.mjs', 'scripts/qa/session-restoration-fault-proxy.mjs',
    'scripts/qa/session-restoration-records.mjs', 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionRestorationTest.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt']) assert(report.sourceFiles[file]);
}

export function validateSessionRestorationProxy(report, proxy) {
  assert.equal(proxy.scope, 'local-session-restoration-controlled-callable-rejection-not-network-loss');
  assert.equal(proxy.projectId, report.projectId); assert.equal(proxy.runId, report.runId); assert.equal(proxy.uid, report.uid);
  assert.equal(proxy.failed, undefined); assert.equal(proxy.phase, 'recover');
  assert.deepEqual(proxy.transitions, [{ from: 'reject', to: 'recover' }]);
  assert.deepEqual(proxy.attempts, [
    ...Array.from({ length: 2 }, () => ({ phase: 'reject', method: 'initializeUserProfile', uid: report.uid,
      injectedRejection: true, downstreamStatus: 503 })),
    ...['initializeUserProfile', 'getActiveRide', 'initializeUserProfile', 'getActiveRide']
      .map(method => ({ phase: 'recover', method, uid: report.uid, upstreamStatus: 200, downstreamStatus: 200 })),
  ]);
}

export function validateSessionRestorationDeviceBundle(root, source) {
  const directory = dirname(resolve(root, source)), read = file => readFileSync(resolve(directory, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source)));
  validateSessionRestorationReport(report);
  validateSessionRestorationProxy(report, json('session-restoration-proxy.json'));
  const marker = json('local-session-restoration-device.json');
  for (const [key, value] of Object.entries(marker)) assert.deepEqual(report[key], value);
  const { isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app } = report;
  assert.deepEqual(json('session-restoration-app-results.json'), app);
  const pull = json('adb-pull-session-restoration.json');
  assert.equal(pull.projectId, report.projectId); assert.equal(pull.runId, report.runId);
  assert.equal(pull.phase, 'session-restoration'); assert.equal(pull.completed, true); assert.equal(pull.status, 0);
  assert.equal(pull.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(pull.signal, null); assert.equal(pull.errorCode, null);
  const transcript = read('LocalSessionRestorationTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1); assert.equal(sha(transcript), report.transcriptSha256);
  assert.equal(json('session-restoration-suite-status.json').status, 0);
  assert.equal(json('session-restoration-suite-status.json').scope, 'session-restoration-command-status-not-flow-verification');
  validateContinuousDeviceEvidence({ setup: json('disposable-device-setup.json'), setupBytes: read('disposable-device-setup.json'),
    restored: json('disposable-device-restore.json'), claimed: read('disposable-device-setup.json.claimed'), report });
  for (const file of sessionRestorationCaptures) {
    const bytes = read(file); assert.equal(sha(bytes), report.screenshots[file]);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.length > 24); assert(bytes.readUInt32BE(16) >= 300);
    assert.equal(bytes.readUInt32BE(16) > bytes.readUInt32BE(20), /rotated-error|recovered/.test(file));
  }
  assertRetainedSourceFiles(root, report.sourceFiles);
  return report;
}

export function validateRetainedSessionRestoration(root, source) {
  const report = validateSessionRestorationDeviceBundle(root, source);
  const directory = dirname(resolve(root, source)), read = file => readFileSync(resolve(directory, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const context = json('retained-context.json'), ci = json('native-ci-run.json'), artifact = json('artifact-metadata.json');
  assert.equal(context.runId, report.runId);
  assert.equal(context.scope, 'single-local-session-restoration-native-trial-not-complete-release');
  assert.deepEqual(context.reviewedCaptures, publishedSessionRestorationCaptures);
  for (const key of ['physicalDevice', 'realNetworkLossVerified', 'productionDeployed', 'safetyAuditAccepted',
    'storeReviewAccepted', 'wholeWorkflowSuccessClaimed']) assert.equal(context[key], false);
  assert.equal(context.identityCaptureRetainedOnly, true);
  assert.equal(context.sourceCommit, 'bf7e5aacea86ed872c078856d6cc2fd4bab52ee4');
  assert.equal(ci.headSha, context.sourceCommit); assert.equal(ci.databaseId, context.workflowRunId);
  assert.equal(ci.databaseId, 39415695486); assert.equal(ci.name, 'Native CI');
  assert.equal(ci.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39415695486');
  assert.equal(ci.event, 'pull_request');
  const jobs = ci.jobs.filter(job => job.name === 'Android focused safety UI tests / Isolated session-restoration');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].databaseId, context.caseJobId);
  assert.equal(jobs[0].databaseId, 118604032135); assert.equal(jobs[0].status, 'completed'); assert.equal(jobs[0].conclusion, 'success');
  for (const name of ['Compile isolated app before starting the device', 'Run one isolated safety flow on its own phone',
    'Retain focused outcomes and independent cleanup']) {
    const steps = jobs[0].steps.filter(step => step.name === name);
    assert.equal(steps.length, 1); assert.equal(steps[0].conclusion, 'success'); assert.equal(steps[0].status, 'completed');
  }
  assert.equal(artifact.id, context.artifactId); assert.equal(artifact.id, 12261907492);
  assert.equal(artifact.name, 'android-focused-safety-ui-session-restoration');
  assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), [...sessionRestorationCaptures, 'local-session-restoration-device.json',
    'session-restoration-app-results.json', 'session-restoration-results.json', 'session-restoration-proxy.json',
    'adb-pull-session-restoration.json', 'LocalSessionRestorationTest-instrumentation.txt', 'disposable-device-setup.json',
    'disposable-device-restore.json', 'disposable-device-setup.json.claimed', 'session-restoration-suite-status.json',
    'native-ci-run.json', 'artifact-metadata.json', 'retained-context.json'].sort());
  for (const [file, hash] of Object.entries(hashes)) { assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file); }
  return report;
}
