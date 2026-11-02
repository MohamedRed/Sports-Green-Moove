import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const focusedCopyFailureFolder = 'docs/release/evidence/focused-copy-5d34c0f-2026-11-02/';
export function validateFocusedCopyFailure(root) {
  const folder = resolve(root, focusedCopyFailureFolder), bytes = file => readFileSync(resolve(folder, file));
  const read = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review = read('review.json'); assert.equal(review.sourceCommit, '5d34c0f1fac1ba39571c4b420e0c4b81129de5d8');
  assert.equal(review.scope, 'failed-focused-primary-capture-not-messaging-delivery-or-release-proof');
  assert.equal(review.runId, 41513990057); assert.equal(review.jobId, 125512708927);
  assert.equal(review.artifactId, 13175670166); assert.equal(review.artifactBytes, 1643715);
  assert.equal(review.artifactSha256, '5bedc554847249cbc8491c47fd5ee53519ad7603728ffa38919ad3def8f2ce7c');
  for (const key of ['primaryCopyPassed', 'exactDisconnectCauseProven', 'repairProven', 'fullNativeGateAccepted',
    'physicalDeviceAccepted', 'pushDeliveryVerified', 'productionWrites', 'releaseComplete']) assert.equal(review[key], false, key);
  for (const key of ['hostAndGuestDisconnectObserved', 'deviceRestorationVerified', 'hostExitObserved', 'notificationPermissionRestored'])
    assert.equal(review[key], true, key);
  assert.equal(review.publicCapturesAdded, 0); assert.equal(review.commandStatus, 1);
  assert.equal(read('suite-status.json').status, 1);
  for (const [file, cases, field] of [['read-components.txt', 3, 'componentReadCases'], ['session-exit.txt', 3, 'sessionExitCases'],
    ['alert-opening.txt', 8, 'alertOpeningCases'], ['alert-platform.txt', 4, 'platformCases']]) {
    assert(bytes(file).toString().includes(`OK (${cases} tests)`)); assert.equal(review[field], cases);
  }
  for (const name of ['read-components', 'session-exit']) {
    const report = read(name + '.json'); assert.equal(report.componentCaseCount, 3);
    assert.equal(createHash('sha256').update(bytes(name + '.txt')).digest('hex'), report.transcriptSha256);
    assert.equal(report.physicalDevice, false); assert.equal(report.productionWrites, false);
  }
  const copy = read('failed-primary-copy.json'); assert.equal(copy.status, 1); assert.equal(copy.completed, false);
  assert.equal(copy.phase, 'team-alert-opening');
  assert(copy.hostAfter.daemonEvents.events.some(row => row.kind === 'connection-terminated-read-failed'));
  const diagnostics = read('sync-diagnostics.json');
  assert(diagnostics.observations.some(row => !row.collected && row.stderr.includes('device offline')));
  assert(diagnostics.observations.some(row => row.id === 'storage-service-log' && row.collected && row.value.includes('connection terminated: write failed')));
  const restoration = read('device-restoration.json'); assert.equal(restoration.restored, true); assert.equal(restoration.verified, true);
  const exit = read('host-exit.json'); assert.equal(exit.targetExitObserved, true); assert.equal(exit.finalState, 'gone');
  assert.equal(exit.flowAccepted, false); assert.equal(exit.rootCauseConfirmed, false);
  assert.equal(read('notification-restoration.json').restored, true);
  const checks = read('pr-checks.json'); assert.equal(checks.headRefOid, review.sourceCommit);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert(checks.statusCheckRollup.some(row => row.name === 'Android native UI tests' && row.conclusion === 'SUCCESS'));
  assert(checks.statusCheckRollup.some(row => row.name.endsWith('Isolated team-read-components') && row.conclusion === 'FAILURE'));
  assert(checks.statusCheckRollup.some(row => row.name.endsWith('Isolated safety flows') && row.conclusion === 'FAILURE'));
  const sources = read('source-files.json'); assertRetainedSourceFiles(root, sources);
  for (const file of ['read-components.json', 'session-exit.json']) {
    const reported = read(file).sourceFiles; assertRetainedSourceFiles(root, reported);
    for (const [path, hash] of Object.entries(reported)) assert.equal(sources[path], hash);
  }
  const assertion = read('assertion-reproduction.json');
  assert.equal(assertion.scope, 'observed-local-clock-substring-collision-not-remote-copy-cause');
  assert.equal(assertion.oldPredicateRejected, true); assert.equal(assertion.collisionField, 'monotonicMs');
  assert.equal(assertion.observedMonotonicMs, 225.555708); assert.deepEqual(assertion.observedPorts, [[5555, 48350]]);
  for (const key of ['remoteFailureExplained', 'runtimeObserverChanged', 'physicalTrialExecuted']) assert.equal(assertion[key], false);
  assert.match(bytes('separate-local-assertion-failure.txt').toString(), /225\.555708/);
  return {mainNativeJobPassed: true, focusedJobPassed: false, fullNativeGateAccepted: false, remoteFailureRepaired: false};
}

export const currentNativeFailureFolder = 'docs/release/evidence/native-checks-1030dac-2026-11-02/';
export function assertCurrentNativeFailureScope(review) {
  assert.equal(review.scope, 'terminal-current-checks-with-primary-copy-and-preparation-failures-not-release-proof');
  for (const [key, value] of Object.entries({sourceCommit: '1030dacade440644028cdd2de072c45718b9d7a4',
    checkedAt: '2026-11-02', nativeRunId: 41519576523, nativeJobId: 125531814779,
    ordinaryPassed: 248, ordinarySkipped: 55, ordinaryFailed: 0, focusedPassed: 9, focusedFailed: 2,
    passedChecks: 20, failedChecks: 4, skippedChecks: 6, restoredDevices: 11, hostExitsObserved: 11,
    selectedMemberDigestsRecorded: true, publicCapturesAdded: 0})) assert.equal(review[key], value, key);
  for (const key of ['originalArchiveDigestIndependentlyVerified', 'fullNativeGateAccepted', 'primaryCopyRepaired',
    'signupParentApprovalAccepted', 'physicalDeviceAccepted', 'productionWrites', 'releaseComplete', 'rootCauseConfirmed'])
    assert.equal(review[key], false, key);
}
export function validateCurrentNativeFailure(root) {
  const folder = resolve(root, currentNativeFailureFolder), bytes = name => readFileSync(resolve(folder, name));
  const json = name => JSON.parse(bytes(name)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'); assertCurrentNativeFailureScope(review);
  const checks = json('pr-checks.json'); assert.equal(checks.headRefOid, review.sourceCommit);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  for (const [conclusion, count] of [['SUCCESS', 20], ['FAILURE', 4], ['SKIPPED', 6]])
    assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === conclusion).length, count);
  const failedNames = ['Android native UI tests', ...['ride-observation', 'native-startup', 'safety flows']
    .map(name => 'Android focused safety UI tests / Isolated ' + name)];
  assert.deepEqual(checks.statusCheckRollup.filter(row => row.conclusion === 'FAILURE').map(row => row.name).sort(), failedNames.sort());
  const ordinary = parseAndroidJUnitTranscript(bytes('main/ordinary-instrumentation.txt').toString());
  assert.equal(ordinary.passed, 248); assert.equal(ordinary.failed, 0); assert.equal(ordinary.skipped, 55);
  for (const [key, value] of Object.entries(ordinary)) assert.deepEqual(json('main/ordinary-results.json')[key], value);
  assert.deepEqual(json('main/suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  assertInstrumentationPassed(bytes('main/LocalTripChangeInputsFlowTest-instrumentation.txt').toString(), 1);
  const copy = json('main/adb-pull-trip-change-inputs.json'); assert.equal(copy.phase, 'trip-change-inputs');
  assert.equal(copy.completed, false); assert.equal(copy.status, 1); assert.equal(copy.signal, null);
  const diagnostics = json('main/adb-sync-trip-change-inputs-diagnostics.json'); assert.equal(diagnostics.runId, copy.runId);
  assert.equal(diagnostics.observations.filter(row => row.stderr?.includes('device offline')).length, 3);
  assert(diagnostics.observations.some(row => row.collected && row.value?.includes('connection terminated: write failed')));
  const cleanupCopy = json('main/adb-pull-failure-cleanup.json'); assert.equal(cleanupCopy.phase, 'failure-cleanup');
  assert.equal(cleanupCopy.runId, copy.runId); assert.equal(cleanupCopy.completed, true);
  const startup = 'focused/native-startup/';
  assert.equal(json(startup + 'status.json').status, 1);
  assert.match(bytes(startup + 'LocalNativeTrackingStartupTest-instrumentation.txt').toString(), /LocalNativeTrackingStartupTest\.kt:95/);
  assert.match(bytes(startup + 'LocalNativeTrackingStartupTest-instrumentation.txt').toString(), /Tests run: 1,\s+Failures: 1/);
  assert.match(bytes(startup + 'local-native-startup-failure-tree.txt').toString(), /Tag: 'auth.error'/);
  const image = json('image-job.json'); assert.equal(image.id, 125531815667); assert.equal(image.head_sha, review.sourceCommit);
  assert.equal(image.conclusion, 'failure');
  assert.equal(image.steps.find(row => row.name === 'Install the selected device image before reserving storage').conclusion, 'failure');
  assert.equal(image.steps.find(row => row.name === 'Run one isolated safety flow on its own phone').conclusion, 'skipped');
  assert.match(bytes('image-install-excerpt.txt').toString(), /Error reading Zip content from a SeekableByteChannel/);
  const phases = readdirSync(resolve(folder, 'focused')); assert.equal(phases.length, 10);
  for (const phase of phases) assert.equal(json('focused/' + phase + '/status.json').status, phase === 'native-startup' ? 1 : 0);
  for (const path of ['main/', ...phases.map(phase => 'focused/' + phase + '/')]) {
    const restore = json(path + 'restoration.json'), host = json(path + 'host-exit.json');
    assert.equal(restore.restored, true); assert.equal(restore.verified, true);
    for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
    assert.equal(restore.restoration.localPackagesRemoved, true);
    assert.equal(host.finalState, 'gone'); assert.equal(host.targetExitObserved, true);
    assert.equal(host.flowAccepted, false); assert.equal(host.rootCauseConfirmed, false);
  }
  const artifacts = json('artifact-inventory.json'); assert.equal(artifacts.length, 11);
  for (const row of artifacts) {assert.equal(row.workflow_run.head_sha, review.sourceCommit); assert.match(row.digest, /^sha256:[a-f0-9]{64}$/);}
  for (const [file, entry] of Object.entries(json('retained-members.json'))) {
    assert(artifacts.some(row => row.id === entry.artifactId)); assert(!entry.member.includes('..'));
    assert.equal(createHash('sha256').update(bytes(file)).digest('hex'), entry.sha256, file);
  }
  return {ordinaryPassed: 248, focusedPassed: 9, fullNativeGateAccepted: false, rootCauseConfirmed: false};
}
