import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {validateLifecycleNativeMain} from './native-main-lifecycle-evidence.mjs';

export const transferLifecycleFolder = 'docs/release/evidence/transfer-lifecycle-2026-10-31/';
export function validateTransferLifecycle(root) {
  const folder = resolve(root, transferLifecycleFolder), bytes = file => readFileSync(resolve(folder, file)), json = file => JSON.parse(bytes(file));
  const sha = value => createHash('sha256').update(value).digest('hex'); assertEvidenceBundleChecksums(folder);
  for (const [name, runId, artifactId, head, passed] of [
    ['before-probe', 41199832059, 13042610438, '5fa6fc49f73d3b1f4523ee77bd8c818a4d5368dc', false],
    ['candidate-probe', 41202387017, 13042779053, '51c183e7af60a79c3096d55e65eb0b33ce1b0d26', true],
  ]) {
    const run = json(name + '/run.json'), artifact = json(name + '/artifact.json'), report = json(name + '/result.json');
    assert.equal(run.id, runId); assert.equal(run.head_sha, head); assert.equal(run.status, 'completed');
    assert.equal(run.conclusion, passed ? 'success' : 'failure');
    const jobs = json(name + '/jobs.json').jobs; assert.equal(jobs.length, 1); assert.equal(jobs[0].conclusion, run.conclusion);
    assert.equal(artifact.id, artifactId); assert.equal(artifact.workflow_run.id, runId); assert.equal(artifact.workflow_run.head_sha, head);
    const zip = bytes(name + '/original.zip'); assert.equal(zip.length, artifact.size_in_bytes); assert.equal('sha256:' + sha(zip), artifact.digest);
    const members = json(name + '/member-sha256.json'); assert.equal(Object.keys(members).length, passed ? 35 : 28);
    for (const [path, hash] of Object.entries(members)) {
      assert.match(path, /^(environment|result|started|trial-\d{2})\.json$/);
      assert.equal(sha(bytes(name + '/' + path)), hash);
      assert.deepEqual(execFileSync('/usr/bin/unzip', ['-p', resolve(folder, name, 'original.zip'), path]), bytes(name + '/' + path));
    }
    assert.equal(report.plannedTrials, 32); assert.equal(report.success, passed); assert.equal(report.completed, passed);
    assert.equal(report.trials.length, passed ? 32 : 25);
    assert.equal(report.trials.filter(row => row.commandCompleted && row.integrityVerified).length, passed ? 32 : 24);
    for (const row of report.trials) assert.deepEqual(row, json(name + '/trial-' + String(row.index).padStart(2, '0') + '.json'));
    for (const key of ['appInstalled', 'accountsUsed', 'retryPerformed', 'alternateTransportUsed', 'rootCauseConfirmed', 'releaseAccepted']) assert.equal(report[key], false);
    if (!passed) {
      assert.equal(report.trials[24].status, 1); assert.equal(report.trials[24].elapsedMs, 31);
      assert.equal(report.cleanup.removed, false); assert.equal(Object.hasOwn(report, 'emulatorBefore'), false);
      const before = report.hostBefore.socketOwnership.processes[0], after = report.hostAfter.socketOwnership.processes[0];
      assert.equal(before.pid, after.pid); assert.equal(before.startTicks, after.startTicks);
      assert(before.connections.some(row => row.remotePort === 5555)); assert(!after.connections.some(row => row.remotePort === 5555));
      assert(after.connections.some(row => row.localPort === 5037 && row.listening));
    } else {
      assert.equal(report.cleanup.absenceVerified, true);
      assert.deepEqual(report.emulatorBefore.identity, report.emulatorAfter.identity);
      for (const sample of [report.emulatorBefore, report.emulatorAfter]) {
        assert.equal(sample.processState, 'present'); assert.equal(sample.socketsObserved, true);
        assert.equal(sample.rawArgumentsRetained, false); assert.equal(sample.environmentRead, false); assert.equal(sample.deviceCommandsRequested, false);
        assert(sample.connections.some(row => row.localPort === 5555 && row.listening));
        assert(sample.connections.some(row => row.localPort === 5555 && row.state === '01'));
        assert.equal(sample.atomicObservation, false);
      }
      assert.deepEqual(report.emulatorBefore.connections, report.emulatorAfter.connections);
      assert(report.trials.every(row => row.outputCoverage.unclassifiedFailure === false));
    }
    assertRetainedSourceFiles(root, json(name + '/source-sha256.json'));
  }
  const main = validateLifecycleNativeMain(root, folder), review = json('review.json');
  assert.equal(review.scope, 'native-main-pass-with-failed-separate-boot-and-intermittent-transfer-not-release');
  for (const [key, value] of Object.entries({beforeTransferPasses: 24, beforeTransferFailures: 1, candidateTransferPasses: 32,
    mainReplayGroups: 37, mainReplayNativeCases: 40, mainPrimaryCopies: 17})) assert.equal(review[key], value, key);
  for (const key of ['candidateFailureReproduced', 'realFailureLifecycleDistinguished', 'nativeMainArchiveDigestVerified',
    'underlyingCauseConfirmed', 'earlierCopyFailureRepaired', 'passAttributedToObservation', 'retryAdded', 'deadlinesChanged',
    'productCodeChanged', 'fullNativeGateAccepted', 'physicalDeviceAccepted', 'productionWrites', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(review.newLinuxHostObservationAvailable, true); assert.equal(review.probeArchiveDigestsVerified, true);
  assert.deepEqual(review.publishedMedia, []);
  return {beforeTransferPasses: 24, candidateTransferPasses: 32, mainGroups: main.groups, fullNativeGateAccepted: false, releaseAccepted: false};
}
