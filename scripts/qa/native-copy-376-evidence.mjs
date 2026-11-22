import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const copy376Folder = 'docs/release/evidence/native-copy-376addb-2026-11-06/';
export const copy376Identity = {source: '376addb0d2dcc98a0c145247afb40d80dc8bfd34', workflowId: 42261168556,
  jobId: 128041168663, artifactId: 13525793386, runId: 'a70f4bb8d6a6fafc4dc1b7a0c7b8c339',
  bytes: 30646910, sha256: '48be67f0332d978822978dbcf3b09634c0832c9299200a3843d545902506b64e'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateCopy376Evidence(root) {
  const base = resolve(root, copy376Folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  assertEvidenceBundleChecksums(base);
  const report = json('summary.json'); assert.equal(report.sourceCommit, copy376Identity.source);
  assert.equal(report.consentStageVerified, true); assert.equal(report.inputsDeviceCasePassed, true);
  assert.equal(report.transportDisconnectObserved, true); assert.equal(report.cleanupCopyPassed, true);
  for (const key of ['primaryCopyPassed', 'inputsHostStageVerified', 'copyRootCauseConfirmed', 'daemonRestartProven',
    'fullReplayAccepted', 'wholeNativeGateAccepted', 'physicalDeviceAccepted', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.equal(report.newMedia, 0);
  const archive = json('original-archive.json'); assert.equal(archive.artifactId, copy376Identity.artifactId);
  assert.equal(archive.bytes, copy376Identity.bytes); assert.equal(archive.sha256, copy376Identity.sha256);
  const absent = ['trip-change-inputs-ui-stage.json', 'results.json'].map(name =>
    'outputs/local-ui-evidence/' + copy376Identity.runId + '/' + name);
  assert.deepEqual(archive.absentMembers, absent); assert.equal(archive.members.length, 15);
  for (const row of archive.members) {
    assert(!row.file.includes('/') && !row.file.includes('..'));
    assert.equal(row.bytes, bytes(row.file).length); assert.equal(row.sha256, sha(bytes(row.file)));
    assert(row.member.startsWith('outputs/')); assert(!row.member.split('/').includes('..'));
  }
  const run = json('native-run.json'); assert.equal(run.databaseId, copy376Identity.workflowId);
  assert.equal(run.headSha, copy376Identity.source); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(row => row.databaseId === copy376Identity.jobId).conclusion, 'failure');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 12); assert(focused.every(row => row.conclusion === 'success'));
  const artifact = json('artifact-metadata.json'); assert.equal(artifact.id, copy376Identity.artifactId);
  assert.equal(artifact.workflow_run.head_sha, copy376Identity.source); assert.equal(artifact.size_in_bytes, copy376Identity.bytes);
  assert.equal(artifact.digest, 'sha256:' + copy376Identity.sha256);
  const primary = json('primary-copy.json'), cleanup = json('cleanup-copy.json');
  for (const row of [primary, cleanup]) assert.equal(row.runId, copy376Identity.runId);
  assert.equal(primary.phase, 'trip-change-inputs'); assert.equal(primary.status, 1); assert.equal(primary.completed, false);
  assert.equal(primary.signal, null); assert.equal(primary.errorCode, null);
  assert.match(primary.stderr, /guardian-parent-requested\.png: 45%/);
  assert.equal(primary.stdout, ''); assert(!primary.stderr.includes('files pulled, 0 skipped'));
  assert.equal(cleanup.phase, 'failure-cleanup'); assert.equal(cleanup.completed, true); assert.equal(cleanup.status, 0);
  assert.match(cleanup.stderr, /100 files pulled, 0 skipped/);
  assert.deepEqual(primary.hostBefore.adbProcesses, primary.hostAfter.adbProcesses);
  const before = primary.hostBefore.socketOwnership, after = primary.hostAfter.socketOwnership;
  for (const row of [before, after]) {assert.equal(row.completed, false); assert.equal(row.unavailableProcessCount, 1);}
  assert.equal(before.processes[0].pid, 3599); assert.equal(before.processes[0].startTicks, after.processes[0].startTicks);
  assert(before.processes[0].connections.some(row => row.remotePort === 5555));
  assert(!after.processes[0].connections.some(row => row.remotePort === 5555));
  const events = primary.hostAfter.daemonEvents.events;
  assert(events.some(row => row.pid === 3599 && row.timestampLocal === '11-06 17:49:01.380' && row.kind === 'connection-terminated-read-failed'));
  const diagnostics = json('sync-diagnostics.json'); assert.equal(diagnostics.runId, primary.runId);
  assert.equal(diagnostics.observations.filter(row => row.collected === false && row.stderr.includes('device offline')).length, 3);
  const guest = diagnostics.observations.find(row => row.id === 'storage-service-log'); assert.equal(guest.collected, true);
  assert.match(guest.value, /host-18: connection terminated: write failed/); assert.match(guest.value, /host-19: read thread spawning/);
  assertInstrumentationPassed(bytes('inputs-instrumentation.txt').toString(), 1);
  const inputs = json('inputs-device.json'); assert.equal(inputs.runId, primary.runId); assert.equal(inputs.completed, true);
  for (const key of ['nativeTimePickerUsed', 'unconfirmedOriginBlocked', 'unconfirmedDestinationBlocked',
    'originalPlacesExplicitlyKept', 'parentSawBothTimes', 'parentConfirmed', 'missingRouteBlockedApplication']) assert.equal(inputs[key], true);
  const consentCopy = json('consent-primary-copy.json'); assert.equal(consentCopy.runId, primary.runId);
  assert.equal(consentCopy.phase, 'trip-change-parent-confirmation'); assert.equal(consentCopy.completed, true);
  assertInstrumentationPassed(bytes('consent-instrumentation.txt').toString(), 1);
  const consent = json('consent-stage.json'); assert.equal(consent.runId, primary.runId);
  assert.equal(consent.method, 'native-app-three-account-ui-with-independent-persisted-checks');
  assert.deepEqual(consent.records.map(row => [row.status, row.parentCount, row.decisionCount]),
    [['confirmed', 2, 2], ['declined', 2, 1], ['withdrawn', 2, 0]]);
  for (const key of ['tripAndBookingsUnchanged', 'parentViewsScoped', 'outsiderDenied', 'unappliedTripStartDenied']) assert.equal(consent[key], true);
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(consent[key], false);
  const ordinary = json('ordinary-results.json'); assert.equal(ordinary.caseCount, 354); assert.equal(ordinary.passed, 299);
  assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  assert.deepEqual(json('suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const restore = json('device-restoration.json'); assert.equal(restore.verified, true);
  assert.equal(restore.restoration.localPackagesRemoved, true); assert(Object.values(restore.restoration.installAdmin).every(value => value === true));
  assert.equal(json('host-exit.json').finalState, 'gone'); assert.equal(json('host-exit.json').processSignalsRequested, false);
  for (const [path, hash] of Object.entries(json('source-sha256.json'))) {
    assert(path.startsWith('scripts/') || path.startsWith('android/')); assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(sha(readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'))), hash);
  }
  const later = json('later-prerequisite-archive.json');
  assert.equal(later.sourceCommit, '04c9fba781897bb8e567475b845f42bcc7beb658');
  assert.equal(later.workflowId, 42266248833); assert.equal(later.jobId, 128058812440);
  assert.equal(later.status, 'completed'); assert.equal(later.conclusion, 'failure');
  assert.equal(later.artifactId, 13526919229); assert.equal(later.bytes, 52662);
  assert.equal(later.sha256, 'e9cb44a3df4cab7beffe3d887292159c45aa254d61bae6566e7eb3fc3232cffa');
  assert.equal(later.members.length, 4);
  for (const row of later.members) {
    assert(/^later-prerequisite-[a-z0-9-]+\.json$/.test(row.file));
    assert(row.member.startsWith('outputs/store-review-screenshots/network-readiness/') && !row.member.split('/').includes('..'));
    assert.equal(row.bytes, bytes(row.file).length); assert.equal(row.sha256, sha(bytes(row.file)));
  }
  const outcome = json('later-prerequisite-outcome.json'); assert.equal(outcome.runId, 'de8e6d77e4568c17cb50ea9b9620a1be');
  assert.equal(outcome.budgetMs, 180000); assert.equal(outcome.elapsedMs, 180000); assert.equal(outcome.sampleCount, 59);
  assert.equal(outcome.failureKind, 'wifi-prerequisite-deadline'); assert.equal(outcome.testAppsAbsent, true);
  for (const key of ['completed', 'ready', 'settingsChanged', 'radioChanged', 'loggingChanged', 'newProbesIssued',
    'flowCompleted', 'physicalDevice', 'rootCauseFixed']) assert.equal(outcome[key], false);
  for (const [name, index, transport, validated] of [['sample-000.json', 0, 'wifi', false], ['sample-058.json', 58, 'cellular', true]]) {
    const sample = json('later-prerequisite-' + name); assert.equal(sample.runId, outcome.runId);
    assert.equal(sample.index, index); assert.equal(sample.ready, false); assert.deepEqual(sample.active.transports, [transport]);
    assert.equal(sample.active.validated, validated);
    assert.equal(sample.availableCapabilities.find(row => row.transports.includes('wifi')).validated, false);
  }
  const history = json('later-prerequisite-chat-network-validation-before.json'); assert.equal(history.runId, outcome.runId);
  assert.equal(history.newProbesIssued, false); assert.equal(history.atomicObservation, false);
  assert(history.groups.some(row => row.transports.includes('wifi') && row.events.some(event => event.errorKind === 'dns-resolution')));
  return report;
}
