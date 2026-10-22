import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { verifySupportRecoveryCheckpoint } from './manual-support-recovery-checkpoints.mjs';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateSupportProcessRestartScope(report) {
  assert.equal(report.scope, 'physical-unconfirmed-support-restart-and-explicit-retry-not-network-loss-or-release-proof');
  assert.equal(report.checkedAt, '2026-10-22');
  assert.equal(report.nativeSourceCommit, '62578bc88532c26b6c47592d9448ecf652f7cfc8');
  assert.equal(report.apkSha256, '10668e27abfc95e19256bb484860efe34770e08a5169c43ab2b605c25630d0fb');
  for (const field of ['physicalUnconfirmedRestartAndRetryObserved', 'nativeProcessStopVerified',
    'draftRestoredWithoutRetyping', 'explicitRetryObserved', 'originalReportUnchanged']) assert.equal(report[field], true, field);
  for (const field of ['sdkCallsMeasured', 'earlierReplayRootCauseEstablished', 'realNetworkLossVerified', 'urgentEscalationVerified',
    'secondPostConfirmationProcessRestartVerified', 'fullControllerCompleted', 'fullCiPassed', 'allBaselineVerifiedAfterCommit', 'appUninstallVerified',
    'videoRecorded', 'productionWrites', 'productionDeployed', 'releaseComplete']) assert.equal(report[field], false, field);
  assert.equal(report.handlerAttemptsBeforeRetry, 1); assert.equal(report.handlerAttemptsAfterRetry, 2);
  assert.equal(Object.keys(report.publishedCaptures).length, 6); return report;
}

export function validateSupportProcessRestartPhone(root, source) {
  const base = dirname(resolve(root, source)), json = file => JSON.parse(readFileSync(resolve(base, file)));
  const report = validateSupportProcessRestartScope(json('summary.json'));
  const controller = json('checkpoints/session-results.json'), committed = json('checkpoints/committed.json');
  assert.equal(controller.completed, false); assert.equal(controller.adminClientClosed, true);
  assert.equal(committed.protectedRecordCount, 158); assert.equal(committed.originalClaimsUnchanged, true);
  assert.deepEqual(controller.checkpoints.map(row => row.phase), ['prepared', 'committed']);
  assert.deepEqual(verifySupportRecoveryCheckpoint('committed', committed.state, committed.fixture), committed.result);
  const observations = ['uncertain', 'reopened', 'confirmed'].map(phase => {
    const item = json(`checkpoints/${phase}-observation.json`);
    assert.equal(item.runId, controller.runId); assert.equal(item.flowAccepted, false);
    assert.equal(item.baselineScope, 'saved-request-and-operation-only-after-committed-checkpoint');
    assert.equal(item.foreignReadDenied, true); assert.equal(item.physicalUiVerifiedByScript, false);
    assert.equal(item.physicalNetworkVerifiedByScript, false); assert.equal(item.processIdentityVerifiedByScript, false);
    assert.deepEqual(verifySupportRecoveryCheckpoint(phase, item.state, item.fixture), item.result);
    assert.deepEqual(item.state.reports, [committed.fixture.originalReport]);
    assert.deepEqual(item.state.operations, [committed.fixture.originalOperation]);
    assert(!item.state.foreignList.items.some(row => row.id === committed.fixture.reportId)); return item;
  });
  const actions = json('captures/operator-actions.json');
  const action = label => {
    const rows = actions.filter(row => row.label === label); assert.equal(rows.length, 1, label);
    assert.equal(rows[0].status, 'completed', label); return rows[0];
  };
  const send = action('native-initial-send-once'), stop = action('native-confirm-force-stop');
  const reopen = action('native-reopen-after-force-stop'), retry = action('native-explicit-retry-once-after-process-restart');
  const before = json('captures/process-before-stop.json'), stopped = json('captures/process-stopped.json');
  const after = json('captures/process-reopened.json');
  assert.equal(before.pid, 30741); assert.equal(after.pid, 9503); assert.equal(after.previousPid, before.pid);
  assert.equal(stopped.noProcessFound, true); assert.equal(after.interveningNoProcessObserved, true);
  assert(send.finishedAt < observations[0].recordedAt && observations[0].recordedAt < before.recordedAt);
  assert(before.recordedAt < stop.startedAt && stop.finishedAt < stopped.recordedAt);
  assert(stopped.recordedAt < reopen.startedAt && reopen.finishedAt < after.recordedAt);
  assert(after.recordedAt < observations[1].recordedAt && observations[1].recordedAt < retry.startedAt);
  assert(retry.finishedAt < observations[2].recordedAt);
  assert(!actions.some(row => /native-.*(?:paste|insert|enter-fixture|focus-description|focus-reason)/.test(row.label) &&
    row.startedAt > reopen.finishedAt && row.startedAt < retry.startedAt), 'Restored text must not be re-entered');
  const attempts = observations[2].state.attempts.toSorted((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  assert.equal(attempts.length, 2); assert.deepEqual(attempts.map(row => row.receipt.reused), [false, true]);
  assert(attempts[0].recordedAt < stop.startedAt && retry.startedAt < attempts[1].recordedAt);
  assert.equal(json('gate/release.json').scope, 'diagnostic-release-not-accepted-phone-recovery');
  const logs = json('captures/log-export-metadata.json'); assert.equal(logs.sdkCallCountMeasured, false);
  assert.equal(logs.reports.length, 2); assert.equal(logs.reports[0].sha256, logs.reports[1].sha256);
  for (const item of logs.reports) {
    assert.equal(item.traceLineCount, 0); assert.equal(item.currentProcess9503Present, false); assert.equal(item.earlierProcess30741Present, false);
  }
  const cleanup = json('cleanup.json');
  for (const field of ['physicalSessionStopped', 'hostClipboardRestored', 'helperProcessGroupExitVerified',
    'helperPrivateDirectoryRemoved', 'privateSessionFileRemoved']) assert.equal(cleanup[field], true, field);
  for (const field of ['appUninstallVerified', 'appPrivateStorageClearedVerified', 'networkSimulationChanged',
    'deviceAdministrationChanged', 'phoneFixtureCredentialsUsableAfterBackendDestruction']) assert.equal(cleanup[field], false, field);
  assert.equal(cleanup.backendExitCode, 130); assert.equal(cleanup.helperExitCode, 130);
  assert.deepEqual(cleanup.listeningPortsAfterCleanup, []);
  assert.match(readFileSync(resolve(base, 'captures/session-stopped-state.txt'), 'utf8'), /App Live Dashboard/);
  assert.match(readFileSync(resolve(base, 'captures/provider-uninstall-after-reattach-state.txt'), 'utf8'), /No user apps found to uninstall/);
  const ci = json('native-ci.json'); assert.equal(ci.headSha, report.nativeSourceCommit);
  assert.equal(ci.status, 'completed'); assert.equal(ci.conclusion, 'failure');
  assert.match(readFileSync(resolve(base, 'native-ci-failed-step.txt'), 'utf8'), /EvidenceCollectionError.*trip-consent-recovery/);
  for (const file of Object.values(report.publishedCaptures)) assert(file.startsWith('captures/') && file.endsWith('.png'));
  assertEvidenceBundleChecksums(base); return report;
}
