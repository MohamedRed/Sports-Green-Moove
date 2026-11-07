import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';
import { verifySupportRecoveryCheckpoint } from './manual-support-recovery-checkpoints.mjs';

export function validateSupportDiagnosticScope(report) {
  assert.equal(report.scope, 'incomplete-support-replay-and-prepared-diagnostics-not-accepted-user-flow');
  assert.equal(report.checkedAt, '2026-10-22'); assert.equal(report.baseCommit, '000ed178b3fb8cf54011ba449661b66bbe320db8');
  assert.equal(report.recordedNativeSendActions, 1); assert.equal(report.handlerAttempts, 3);
  for (const key of ['physicalAttempt', 'gateExpired', 'recordIntegrityVerified', 'callDiagnosticsCompiled', 'runnerReadinessUnitVerified'])
    assert.equal(report[key], true, key);
  for (const key of ['physicalRecoveryAccepted', 'sdkInvocationsMeasured', 'operatorJournalIsIndependentDeviceTrace',
    'replayOriginEstablished', 'pendingProcessRestartVerified', 'explicitRetryVerified', 'callDiagnosticsPhysicalDeviceVerified',
    'runnerReadinessRemoteVerified', 'midCopyFailureRootCauseEstablished', 'videoRecorded', 'urgentEscalationVerified',
    'productionWrites', 'productionDeployed', 'releaseComplete']) assert.equal(report[key], false, key);
  assert.deepEqual(report.publishedCaptures, {}); return report;
}

export function validateSupportDiagnosticEvidence(root, source) {
  const base = dirname(resolve(root, source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = validateSupportDiagnosticScope(json('summary.json'));
  const controller = json('checkpoints/session-results.json');
  assert.equal(controller.completed, false); assert.equal(controller.adminClientClosed, true);
  assert.deepEqual(controller.checkpoints.map(row => row.phase), ['prepared', 'committed']);
  const committed = json('checkpoints/committed.json'); assert.equal(committed.protectedRecordCount, 158);
  assert.deepEqual(verifySupportRecoveryCheckpoint('committed', committed.state, committed.fixture), committed.result);
  const records = json('post-failure-records.json'); assert.equal(records.runId, controller.runId);
  assert.equal(records.flowAccepted, false); assert.equal(records.gateExpired, true);
  assert.equal(records.operatorJournalIsIndependentDeviceTrace, false);
  assert.deepEqual(records.reports, [committed.fixture.originalReport]);
  assert.deepEqual(records.operations, [committed.fixture.originalOperation]);
  assert.deepEqual(records.attempts.map(row => row.receipt.reused), [false, true, true]);
  assert.equal(records.attempts.length, report.handlerAttempts);
  for (const row of records.attempts) {
    assert.equal(row.receipt.reportId, committed.fixture.reportId); assert.equal(row.receipt.clientRequestId, committed.fixture.requestId);
  }
  assert.equal(records.foreignReadDenied, true); assert(!records.foreignList.items.some(row => row.id === committed.fixture.reportId));
  assert.doesNotMatch(JSON.stringify(records.view), /digest|clientRequestId|reviewNote|reviewEvents/);
  const actions = json('captures/operator-actions.json'), sends = actions.filter(row => row.label === 'native-initial-send-once');
  assert.equal(sends.length, 1); assert.equal(sends[0].status, 'completed');
  assert(!actions.some(row => row.label.startsWith('native-') && row.startedAt > sends[0].finishedAt && row.startedAt < records.attempts[1].recordedAt));
  assert.equal(existsSync(resolve(base, 'gate/release.json')), false); assert(json('gate/expired.json'));
  const apk = json('prepared-apk.json'); assert.match(apk.sha256, /^[a-f0-9]{64}$/); assert.equal(apk.nativeSourceDirty, true);
  assert.equal(apk.debug.SGM_LOCAL_SUPPORT_TRACE, true); assert.equal(apk.release.SGM_LOCAL_SUPPORT_TRACE, false);
  for (const config of [apk.debug, apk.release]) {
    assert.equal(config.SGM_USE_FIREBASE_EMULATOR, true); assert.equal(config.SGM_LOCAL_REAL_MAPS_UI, false);
  }
  assert.equal(apk.physicalDeviceObserved, false); assert.equal(apk.nonIsolatedTraceBuildExitCode, 1);
  assert.match(bytes('rejected-production-trace-build.txt').toString(), /Support call diagnostics require the isolated Firebase emulator build/);
  assert.match(bytes('trace-debug-build.txt').toString(), /BUILD SUCCESSFUL/);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes('call-boundary-tests.xml').toString()).testsuite;
  assert.equal(Number(suite['@_tests']), 5);
  for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  assert.match(bytes('node-tests.txt').toString(), /# fail 0\n/);
  const ci = json('native-ci.json'); assert.equal(ci.headSha, report.baseCommit); assert.equal(ci.status, 'completed');
  assert.equal(ci.conclusion, 'failure'); assert.match(bytes('native-ci-failed-step.txt').toString(), /Select one available disposable Android emulator/);
  const cleanup = json('cleanup.json');
  for (const key of ['physicalSessionStopped', 'appUninstallProviderConfirmed', 'appUninstallNativeDrawerVerified',
    'networkSimulationRemoved', 'connectedWifiObserved', 'hostClipboardRestored', 'helperProcessGroupExitVerified',
    'helperPrivateDirectoryRemoved', 'privateSessionFileRemoved']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.controllerCompleted, false); assert.equal(cleanup.deviceAdministrationChanged, false);
  assert.deepEqual(cleanup.listeningPortsAfterCleanup, []);
  assert.match(bytes('captures/provider-uninstall-result-state.txt').toString(), /Succesfully uninstalled your app/);
  assert.match(bytes('captures/session-stopped-state.txt').toString(), /App Live Dashboard/);
  for (const [file, expected] of Object.entries(json('source-sha256.json')))
    assert.equal(createHash('sha256').update(bytes('source/' + file)).digest('hex'), expected);
  assertEvidenceBundleChecksums(base); return report;
}
