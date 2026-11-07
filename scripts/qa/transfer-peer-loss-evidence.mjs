import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const transferPeerLossFolder = 'docs/release/evidence/transfer-peer-loss-2026-10-31/';
export function validateTransferPeerLoss(root) {
  const folder = resolve(root, transferPeerLossFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), sha = value => createHash('sha256').update(value).digest('hex');
  assertEvidenceBundleChecksums(folder);
  const run = json('run.json'), job = json('job.json'), artifact = json('artifact.json'), report = json('result.json');
  assert.equal(run.id, 41206766250); assert.equal(run.head_sha, '16835261a8b9cb02420f9be107e9cd98337564b5');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(job.id, 124553316302); assert.equal(job.run_id, run.id); assert.equal(job.conclusion, 'failure'); assert.equal(job.status, 'completed');
  assert.equal(job.steps.find(row => row.name === 'Run fixed primary transfers without app accounts or provider requests').conclusion, 'failure');
  assert.equal(artifact.id, 13044905885); assert.equal(artifact.workflow_run.id, run.id); assert.equal(artifact.workflow_run.head_sha, run.head_sha);
  assert.equal(artifact.size_in_bytes, 14941); assert.equal(bytes('original.zip').length, artifact.size_in_bytes);
  assert.equal(artifact.digest, 'sha256:ea17eff03d749af9fdee0d3716c096266b16c1c9d2882c3a4412f66aa96b2af1');
  assert.equal('sha256:' + sha(bytes('original.zip')), artifact.digest);
  const members = json('member-sha256.json'); assert.equal(Object.keys(members).length, 32);
  for (const [file, hash] of Object.entries(members)) {
    assert.match(file, /^(environment|result|started|trial-\d{2})\.json$/); assert.equal(sha(bytes(file)), hash);
    assert.deepEqual(execFileSync('/usr/bin/unzip', ['-p', resolve(folder, 'original.zip'), file]), bytes(file));
  }
  assert.equal(report.plannedTrials, 32); assert.equal(report.trials.length, 29); assert.equal(report.success, false); assert.equal(report.completed, false);
  assert.equal(report.trials.filter(row => row.commandCompleted && row.integrityVerified).length, 28);
  for (const row of report.trials) assert.deepEqual(row, json('trial-' + String(row.index).padStart(2, '0') + '.json'));
  const failed = report.trials.at(-1); assert.equal(failed.index, 28); assert.equal(failed.status, 1); assert.equal(failed.elapsedMs, 47);
  assert.equal(failed.outputCoverage.present, true); assert.equal(failed.outputCoverage.byteCount, 643);
  assert.equal(failed.outputCoverage.recognizedFailure, false); assert.equal(failed.outputCoverage.unclassifiedFailure, true);
  assert.equal(report.cleanup.removed, false); assert.equal(report.cleanup.absenceVerified, false);
  for (const key of ['appInstalled', 'accountsUsed', 'retryPerformed', 'alternateTransportUsed', 'rootCauseConfirmed', 'releaseAccepted']) assert.equal(report[key], false);
  const before = report.emulatorBefore, after = report.emulatorAfter;
  assert.deepEqual(before.identity, {pid: 4056, startedTicks: '19617', executable: 'qemu-system-x86_64-headless', port: 5554, avd: 'test'});
  assert.deepEqual(after.identity, before.identity);
  for (const sample of [before, after]) {
    assert.equal(sample.processState, 'present'); assert.equal(sample.socketsObserved, true); assert.equal(sample.atomicObservation, false);
    for (const key of ['rawArgumentsRetained', 'environmentRead', 'deviceCommandsRequested']) assert.equal(sample[key], false);
  }
  assert.deepEqual(after.connections, before.connections.filter(row => row.listening));
  assert.equal(before.connections.filter(row => row.localPort === 5555 && row.state === '01').length, 1);
  const server = sample => sample.socketOwnership.processes.find(row => row.connections.some(socket => socket.localPort === 5037 && socket.listening));
  const hostBefore = server(report.hostBefore), hostAfter = server(report.hostAfter);
  assert.equal(hostBefore.pid, 4224); assert.equal(hostAfter.pid, hostBefore.pid);
  assert.equal(hostBefore.startTicks, '20618'); assert.equal(hostAfter.startTicks, hostBefore.startTicks);
  assert.deepEqual(hostAfter.connections, hostBefore.connections.filter(row => row.listening));
  assert(hostBefore.connections.some(row => row.remotePort === 5555 && row.localPort === 36257));
  assert.equal(report.hostBefore.adbProcesses.length, 14); assert.equal(report.hostAfter.adbProcesses.length, 1);
  assert(report.hostAfter.daemonEvents.events.some(row => row.pid === 4224 && row.kind === 'connection-terminated-read-failed'));
  assert.equal(report.traceAfter.counts.payloadReadEnded, report.traceBefore.counts.payloadReadEnded + 1);
  assert.equal(report.traceAfter.counts.transportReadFailed, report.traceBefore.counts.transportReadFailed + 1);
  assertRetainedSourceFiles(root, json('source-sha256.json'));
  const review = json('review.json'); assert.equal(review.scope, 'surviving-host-emulator-and-adb-server-with-peer-loss-not-guest-state-or-repair');
  for (const [key, value] of Object.entries({passedPrimaryTransfers: 28, failedPrimaryAttempt: 29, unexecutedPlannedTransfers: 3,
    originalArchiveDigestVerified: true, hostEmulatorObservedPresentAfterFailure: true, sameEmulatorBirth: true,
    sameHostAdbServerBirthAndListener: true, priorEmulatorPeerSocketAbsentAfterFailure: true})) assert.equal(review[key], value, key);
  for (const key of ['guestBootStateKnown', 'guestAdbdStateKnown', 'hostProcessContinuityFullyObserved',
    'newParentAndStateFieldsExercised', 'remoteCleanupVerified', 'runnerDisposalIndependentlyVerified', 'rootCauseConfirmed',
    'earlierCopyFailureRepaired', 'productCodeChanged', 'retryAdded', 'deadlinesChanged', 'fullNativeGateAccepted',
    'physicalDeviceAccepted', 'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.publishedMedia, []);
  return {passedPrimaryTransfers: 28, failedPrimaryAttempt: 29, sameHostProcessesObserved: true, rootCauseConfirmed: false, releaseAccepted: false};
}
