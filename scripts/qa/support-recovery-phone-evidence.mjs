import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { verifySupportRecoveryCheckpoint, verifySupportUnclassifiedReplay } from './manual-support-recovery-checkpoints.mjs';

export function validateSupportRecoveryPhoneScope(report) {
  assert.equal(report.scope, 'incomplete-physical-support-recovery-attempt-not-accepted-retry-or-restart');
  assert.equal(report.checkedAt, '2026-10-22');
  assert.equal(report.baseCommit, 'bafc9d0234757f3a34f3960189c5bd2c7d026b51');
  for (const key of ['physicalDevice', 'nativeSourceClean', 'testHarnessDirty', 'recordIntegrityVerified', 'urgentFlagRetained'])
    assert.equal(report[key], true, key);
  for (const key of ['completed', 'flowAccepted', 'explicitRetryVerified', 'pendingProcessRestartVerified', 'replayOriginEstablished',
    'urgentEscalationVerified', 'emergencyCallVerified', 'trackingNetworkLossVerified', 'iosPhysicalUiVerified',
    'productionWrites', 'productionDeployed', 'releaseComplete', 'videoRecorded']) assert.equal(report[key], false, key);
  assert.equal(report.offlineMethod, 'supported-provider-offline-mode-not-persistent-manual-wifi-toggle');
  assert.equal(report.publication, 'held-owner-private-audience-not-restored');
  return report;
}

export function validateSupportRecoveryPhoneEvidence(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file));
  const report = validateSupportRecoveryPhoneScope(json('summary.json'));
  const controller = json(report.controller); assert.equal(controller.completed, false);
  assert.equal(controller.adminClientClosed, true); assert.equal(controller.protectedRecordCount, 158);
  const phases = ['prepared', 'committed', 'offline', 'uncertain'];
  assert.deepEqual(controller.checkpoints.map(row => row.phase), phases);
  for (const phase of phases) {
    const checkpoint = json('checkpoints/' + phase + '.json');
    assert.equal(checkpoint.runId, controller.runId); assert.equal(checkpoint.projectId, 'demo-sgm-local-qa');
    assert.equal(checkpoint.protectedRecordCount, 158); assert.equal(checkpoint.originalClaimsUnchanged, true);
    assert.deepEqual(verifySupportRecoveryCheckpoint(phase, checkpoint.state, checkpoint.fixture), checkpoint.result);
  }
  const final = json(report.finalRecords); assert.equal(final.runId, controller.runId);
  assert.equal(final.lateConfirmationAccepted, false);
  assert.equal(final.baselineScope, 'saved-request-and-operation-only-after-uncertain-checkpoint');
  assert.deepEqual(verifySupportUnclassifiedReplay(final.state, final.fixture), final.result);
  const times = final.state.attempts.map(row => row.recordedAt).sort();
  assert.deepEqual(times, ['2026-10-22T19:43:46.862Z', '2026-10-22T19:46:53.058Z']);
  assert.equal(json('gate/released.json').handlerClosedBeforeReleaseAt, null);
  assert.match(bytes('captures/network-provider-offline.txt').toString(), /The device is now offline/);
  for (const file of ['captures/network-before.json', 'captures/network-prepared.json', 'captures/network-offline.json',
    'captures/network-offline-second-observation.json', 'captures/network-restored.json']) {
    const network = json(file); assert.equal(network.state, 'CONNECTED'); assert.equal(network.transport, 'WIFI');
    assert.equal(network.identifiersRetained, false);
  }
  const process = json('captures/process-after-kill-request.json');
  assert.equal(process.latestPid, process.preparedPid); assert.equal(process.noProcessFound, false);
  const cleanup = json('cleanup.json');
  for (const key of ['physicalSessionStopped', 'networkRestored', 'networkSimulationRemoved', 'controllerClosed',
    'helperProcessGroupExitVerified', 'helperPrivateDirectoryRemoved', 'privateSessionFileRemoved']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.appUninstallIndependentlyVerified, false); assert.equal(cleanup.deviceAdministrationChanged, false);
  assert.deepEqual(cleanup.listeningPortsAfterCleanup, []); assert.equal(cleanup.productionWrites, false);
  assert.match(bytes(cleanup.physicalSessionProof).toString(), /App Live Dashboard/);
  for (const file of Object.values(report.publishedCaptures)) {
    const size = imageSize(bytes(file)); assert.equal(size.width, 250); assert.equal(size.height, 562);
    const metadata = json(file.replace('.png', '.json'));
    assert.equal(metadata.source, 'unaltered-browser-capture-of-physical-phone'); assert.equal(metadata.syntheticDataOnly, true);
    assert(metadata.observedAt.startsWith(report.checkedAt));
    assert(imageSize(bytes(file.replace('.png', '-context.png'))).width > size.width);
  }
  assert.match(bytes('targeted-tests.txt').toString(), /# pass 20\n/);
  assert.match(bytes('targeted-tests.txt').toString(), /# fail 0\n/);
  const ci = json('native-ci.json'); assert.equal(ci.headSha, report.baseCommit);
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'failure');
  assert.match(bytes('native-ci-failed-step.txt').toString(), /Local evidence collection failed during confirmed-restart/);
  for (const [file, hash] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), hash);
  assertEvidenceBundleChecksums(base); return report;
}
