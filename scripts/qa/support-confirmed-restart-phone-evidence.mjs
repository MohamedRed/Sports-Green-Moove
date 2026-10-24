import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { imageSize } from 'image-size';
import { supportRecoveryProtocol, verifySupportProtocolCheckpoint } from './support-recovery-protocol.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateConfirmedSupportScope(report) {
  assert.equal(report.scope, 'connected-physical-support-pending-and-confirmed-force-stop-with-independent-record-checkpoints');
  assert.equal(report.checkedAt, '2026-10-23');
  assert.equal(report.baseCommit, '6441dca55622ea8370051361047f779a9b7b26f2');
  assert.equal(report.apkSha256, '10668e27abfc95e19256bb484860efe34770e08a5169c43ab2b605c25630d0fb');
  assert.equal(report.scenario, 'connected-process-restart');
  for (const key of ['pendingDraftRestoredWithoutRetyping', 'explicitRetryObserved',
    'confirmedDraftAbsentAfterSecondForceStop', 'fullControllerCompleted', 'originalReportUnchanged']) assert.equal(report[key], true, key);
  for (const key of ['processIdsMeasured', 'sdkCallsMeasured', 'earlierReplayRootCauseEstablished', 'realNetworkLossVerified',
    'urgentEscalationVerified', 'finalPhysicalHistoryReadVerified', 'appUninstallVerified', 'videoRecorded',
    'productionWrites', 'productionDeployed', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.equal(report.nativeForceStopDialogsObserved, 2); assert.equal(report.protectedRecordsAtEveryCheckpoint, 158);
  assert.equal(report.handlerAttemptsBeforeRetry, 1); assert.equal(report.handlerAttemptsAfterRetry, 2);
  assert.equal(report.publication, 'held-owner-private-audience-not-restored'); return report;
}

export function validateConfirmedSupportPhone(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = validateConfirmedSupportScope(json('summary.json'));
  const controller = json('checkpoints/session-results.json'), protocol = supportRecoveryProtocol(report.scenario);
  assert.equal(controller.completed, true); assert.equal(controller.adminClientClosed, true);
  assert.equal(controller.scenario, report.scenario); assert.equal(controller.protectedRecordCount, 158);
  assert.equal(controller.physicalNetworkStateVerifiedByController, false); assert.equal(controller.processIdentityVerified, false);
  assert.deepEqual(controller.checkpoints.map(row => row.phase), protocol.phases);
  let previous = '';
  for (const [index, phase] of protocol.phases.entries()) {
    const row = json('checkpoints/' + phase + '.json');
    assert.equal(row.projectId, 'demo-sgm-local-qa'); assert.equal(row.runId, controller.runId);
    assert.equal(row.protectedRecordCount, 158); assert.equal(row.originalClaimsUnchanged, true);
    assert(previous < row.recordedAt); previous = row.recordedAt;
    assert.deepEqual(verifySupportProtocolCheckpoint(protocol, phase, row.state, row.fixture), row.result);
    assert.deepEqual(row.result, controller.checkpoints[index]);
  }
  const captures = json('capture-index.json'), capturedAt = file => captures.captures.find(row => row.file === 'originals/' + file)?.capturedAt;
  const checkpointAt = phase => json('checkpoints/' + phase + '.json').recordedAt;
  const before = json('checkpoints/reopened.json'), after = json('checkpoints/confirmed.json');
  const attempts = after.state.attempts.toSorted((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  assert.equal(before.state.attempts.length, 1); assert.deepEqual(attempts.map(row => row.receipt.reused), [false, true]);
  assert(capturedAt('07-pending-before-explicit-retry.png') < attempts[1].recordedAt);
  assert(attempts[1].recordedAt < capturedAt('08-confirmed.png'));
  assert(capturedAt('04-first-stop-dialog.png') < json('gate/released.json').releasedAt);
  assert(json('gate/released.json').releasedAt < capturedAt('05-first-stopped.png'));
  assert(capturedAt('05-first-stopped.png') < checkpointAt('stopped'));
  assert(checkpointAt('confirmed') < capturedAt('09-confirmed-stop-dialog.png'));
  assert(capturedAt('10-confirmed-stopped.png') < checkpointAt('confirmed-stopped'));
  assert(checkpointAt('confirmed-stopped') < capturedAt('11-confirmed-reopened-no-pending.png'));
  assert(capturedAt('11-confirmed-reopened-no-pending.png') < checkpointAt('confirmed-reopened'));
  assert.equal(Object.keys(report.publishedCaptures).length, 4);
  for (const file of Object.values(report.publishedCaptures)) {
    const size = imageSize(bytes(file)); assert.equal(size.width, 250); assert.equal(size.height, 562);
    const rectangle = captures.rectangles.find(row => row.output === file); assert(rectangle);
    assert(imageSize(bytes(rectangle.source)).width > size.width);
  }
  const cleanup = json('cleanup.json');
  for (const key of ['controllerClosed', 'phoneDashboardObserved', 'unintendedReplacementSessionCancelled', 'hostClipboardRestored',
    'helperProcessGroupExitVerified', 'helperPrivateDirectoryRemoved', 'backendPrivateRuntimeRemoved', 'privateSessionFileRemoved']) assert.equal(cleanup[key], true, key);
  for (const key of ['appUninstallVerified', 'appPrivateStorageClearedVerified', 'deviceAdministrationChanged', 'networkSettingsChanged',
    'storeSettingsChanged', 'phoneSessionEndCauseEstablished', 'phoneFixtureCredentialsUsableAfterBackendDestruction']) assert.equal(cleanup[key], false, key);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 0); assert.deepEqual(cleanup.listeningPortsAfterCleanup, []);
  const terminal = bytes('originals/13-session-ended-cancelled-state.txt').toString();
  assert.match(terminal, /App Live Dashboard/); assert.doesNotMatch(terminal, /STARTING SESSION|Stop Session/);
  for (const [file, hash] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), hash);
  assertEvidenceBundleChecksums(base); return report;
}
