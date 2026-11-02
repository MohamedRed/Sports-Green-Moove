import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

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
