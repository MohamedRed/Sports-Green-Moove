import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validateContinuousDeviceEvidence } from './continuous-device-evidence.mjs';
import { assertSessionDisconnectBefore, assertSessionDisconnectStage, sessionDisconnectScope, sessionDisconnectCaptures } from './session-disconnect-evidence.mjs';

export const sessionDisconnectTranscripts = ['disconnectFromFailedRestoration', 'reopenSignedOutSessionInNewProcess']
  .map(method => `LocalSessionDisconnectTest#${method}-instrumentation.txt`);

export function validateSessionDisconnectReport(report) {
  assert.equal(report.scope, sessionDisconnectScope); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.testCount, 1); assert.equal(report.nativeCaseCount, 2);
  assert.deepEqual(report.steps, [{ id: 'session-disconnect-process-restart', status: 'passed' }]);
  assert.equal(report.primaryEvidencePhase, 'session-disconnect');
  assertSessionDisconnectBefore(report.native.before, report.runId);
  for (const key of ['nativeUiExecuted', 'proxyClosed', 'adminClientClosed', 'localPackagesRemoved',
    'isolatedEnvironmentDestroyed', 'emulatorCliExitedSuccessfully', 'authEmptyBeforeLaunch',
    'signedOutScreenAfterProcessRestart', 'authEmptyAfterLaunch', 'firestoreClientTerminated', 'completed']) assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'realNetworkLossVerified', 'productionWrites', 'safetyAuditAccepted',
    'storeReviewAccepted']) assert.equal(report[key], false, key);
  assert.equal(report.cleanupMode, 'destroy-owned-local-environment');
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.deepEqual(report.fixtureIsolation, {
    allTopLevelCollectionsUnchangedExceptParentTimestamp: true, allUserClaimsUnchanged: true, liveTripsUnchanged: true,
    collections: { bookings: 3, chatInboxes: 4, children: 1, clubs: 3, co2Ledger: 1, memberships: 10,
      messages: 121, notifications: 1, reports: 1, rewardLedger: 1, teams: 1, trips: 2, users: 9 }, accountCount: 5,
  });
  assert.deepEqual(Object.keys(report.transcripts).sort(), [...sessionDisconnectTranscripts].sort());
  for (const file of ['scripts/qa/local-session-disconnect-ui.mjs', 'scripts/qa/local-disposable-process-stop.mjs',
    'scripts/qa/session-disconnect-evidence.mjs', 'scripts/qa/session-restoration-fault-proxy.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionDisconnectTest.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt']) assert(report.sourceFiles[file]);
}

export function validateSessionDisconnectArtifactFiles(root, source) {
  const directory = dirname(resolve(root, source)), read = file => readFileSync(resolve(directory, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(readFileSync(resolve(root, source)));
  validateSessionDisconnectReport(report);
  assertSessionDisconnectStage(report.native.before, report.native.stopped, report, json('session-disconnect-proxy.json'), report.runId);
  for (const [key, value] of Object.entries(json('local-session-disconnect-device.json'))) assert.deepEqual(report[key], value);
  assert.deepEqual(json('local-session-disconnect-before.json'), report.native.before);
  assert.deepEqual(json('local-session-disconnect-stop.json'), report.native.stopped);
  const { isolatedEnvironmentDestroyed, emulatorCliExitedSuccessfully, emulatorEndpoints, ...app } = report;
  assert.deepEqual(json('session-disconnect-app-results.json'), app);
  const pull = json('adb-pull-session-disconnect.json');
  assert.equal(pull.projectId, report.projectId); assert.equal(pull.runId, report.runId);
  assert.equal(pull.phase, 'session-disconnect'); assert.equal(pull.completed, true); assert.equal(pull.status, 0);
  assert.equal(pull.scope, 'local-adb-file-sync-command-not-flow-verification');
  assert.equal(pull.signal, null); assert.equal(pull.errorCode, null);
  for (const file of sessionDisconnectTranscripts) {
    const raw = read(file); assertInstrumentationPassed(raw.toString(), 1); assert.equal(sha(raw), report.transcripts[file]);
  }
  assert.deepEqual(json('session-disconnect-suite-status.json'), { scope: 'session-disconnect-command-status-not-flow-verification', status: 0 });
  validateContinuousDeviceEvidence({ setup: json('disposable-device-setup.json'), setupBytes: read('disposable-device-setup.json'),
    restored: json('disposable-device-restore.json'), claimed: read('disposable-device-setup.json.claimed'), report });
  for (const file of sessionDisconnectCaptures) {
    const bytes = read(file); assert.equal(sha(bytes), report.screenshots[file]);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.length > 24 && bytes.readUInt32BE(16) >= 300 && bytes.readUInt32BE(20) > bytes.readUInt32BE(16));
  }
  assertRetainedSourceFiles(root, report.sourceFiles);
  return report;
}

export function validateRetainedSessionDisconnect(root, source) {
  const report = validateSessionDisconnectArtifactFiles(root, source);
  const directory = dirname(resolve(root, source)), read = file => readFileSync(resolve(directory, file));
  const json = file => JSON.parse(read(file)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const context = json('retained-context.json'), ci = json('native-ci-run.json'), artifact = json('artifact-metadata.json');
  assert.equal(context.runId, report.runId);
  assert.equal(context.scope, 'single-local-session-disconnect-native-trial-not-complete-release');
  assert.deepEqual(context.reviewedCaptures, sessionDisconnectCaptures);
  for (const key of ['physicalDevice', 'realNetworkLossVerified', 'productionDeployed', 'safetyAuditAccepted',
    'storeReviewAccepted', 'wholeWorkflowSuccessClaimed']) assert.equal(context[key], false);
  assert.equal(context.sourceCommit, '62eef1c4df7ebb96bc98ab357b2783901fb89b7a');
  assert.equal(ci.headSha, context.sourceCommit); assert.equal(ci.databaseId, context.workflowRunId);
  assert.equal(ci.databaseId, 39420260518); assert.equal(ci.name, 'Native CI'); assert.equal(ci.event, 'pull_request');
  assert.equal(ci.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39420260518');
  const jobs = ci.jobs.filter(job => job.name === 'Android focused safety UI tests / Isolated session-disconnect');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].databaseId, context.caseJobId);
  assert.equal(jobs[0].databaseId, 118619147999); assert.equal(jobs[0].status, 'completed'); assert.equal(jobs[0].conclusion, 'success');
  for (const name of ['Compile isolated app before starting the device', 'Run one isolated safety flow on its own phone',
    'Retain focused outcomes and independent cleanup']) {
    const steps = jobs[0].steps.filter(step => step.name === name);
    assert.equal(steps.length, 1); assert.equal(steps[0].conclusion, 'success'); assert.equal(steps[0].status, 'completed');
  }
  assert.equal(artifact.id, context.artifactId); assert(Number.isSafeInteger(artifact.id) && artifact.id > 0);
  assert.equal(artifact.name, 'android-focused-safety-ui-session-disconnect'); assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/);
  const hashes = json('artifact-sha256.json');
  assert.deepEqual(Object.keys(hashes).sort(), [...sessionDisconnectCaptures, ...sessionDisconnectTranscripts,
    'local-session-disconnect-before.json', 'local-session-disconnect-stop.json', 'local-session-disconnect-device.json',
    'session-disconnect-app-results.json', 'session-disconnect-results.json', 'session-disconnect-proxy.json',
    'adb-pull-session-disconnect.json', 'disposable-device-setup.json', 'disposable-device-restore.json',
    'disposable-device-setup.json.claimed', 'session-disconnect-suite-status.json',
    'native-ci-run.json', 'artifact-metadata.json', 'retained-context.json'].sort());
  for (const [file, hash] of Object.entries(hashes)) { assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file); }
  return report;
}
