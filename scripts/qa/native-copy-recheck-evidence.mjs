import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeCopyRecheck(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = file => readFileSync(resolve(base, file));
  const json = file => JSON.parse(bytes(file)), report = json('summary.json'), run = json('run.json'), jobs = json('jobs.json').jobs;
  assert.equal(report.scope, 'terminal-native-copy-failure-with-passing-support-components');
  assert.equal(report.sourceCommit, 'e23809aca59def492636e7ad0a93f7df5e3b6ecd'); assert.equal(run.head_sha, report.sourceCommit);
  assert.equal(run.id, 39797196374); assert.equal(report.runId, run.id); assert.equal(report.jobId, 119887388566);
  assert.equal(report.artifactId, 12435492283); assert.equal(report.testedAt, run.updated_at);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const job = jobs.find(row => row.id === report.jobId); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(row => row.name === 'Run Android Compose UI tests').conclusion, 'failure');
  assert.equal(job.steps.find(row => row.name === 'Upload Android instrumentation reports').conclusion, 'success');
  const artifact = json('artifacts.json').artifacts.find(row => row.id === report.artifactId);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.expired, false);
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests / '));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success')); assert.equal(report.focusedLanesPassed, 11);
  for (const key of ['fullCiPassed', 'fullNativeReplayCompleted', 'productionWrites', 'releaseComplete', 'rootCauseEstablished',
    'processRestartExcludedAsRootCause', 'physicalDeviceEvidence']) assert.equal(report[key], false, key);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(bytes('ordinary-tests.xml').toString()).testsuite;
  assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0'); assert.equal(suite.testcase.length, 195);
  const rows = suite.testcase, passed = rows.filter(row => !('failure' in row) && !('error' in row) && !('skipped' in row));
  assert.equal(passed.length, 145); assert.equal(rows.filter(row => 'skipped' in row).length, 50);
  assert.deepEqual(report.ordinaryCases, { total: 195, passed: 145, skipped: 50, failures: 0, errors: 0 });
  const support = passed.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.SupportInboxFlowTest');
  assert.deepEqual(support.map(row => row['@_name']), ['requesterReadsWrittenReplyAndStatusOnNarrowLargeText', 'failedReadIsNotShownAsAnEmptyInboxAndRefreshIsExplicit']);
  assert.deepEqual(report.supportComponentCases, support.map(row => ({ name: row['@_name'], status: 'passed' })));
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const primary = json('transfer/adb-pull-trip-change-inputs.json'), cleanup = json('transfer/adb-pull-failure-cleanup.json');
  assert.equal(primary.runId, '3916f21ed1105803278e706c37cb3ce1'); assert.equal(primary.phase, report.primaryTransferPhase);
  assert.equal(primary.phase, 'trip-change-inputs'); assert.equal(primary.completed, false); assert.equal(primary.status, 1);
  assert.equal(report.primaryTransferStatus, primary.status); assert.equal(cleanup.status, 1); assert.equal(cleanup.completed, false);
  assert.equal(report.cleanupTransferStatus, cleanup.status); assert.equal(cleanup.runId, primary.runId);
  for (const observation of [primary.hostBefore, primary.hostAfter]) {
    assert.equal(observation.completed, true); assert.equal(observation.rawLogsRetained, false); assert.equal(observation.deviceCommandRequested, false);
    assert.equal(observation.scope, 'host-adb-process-and-log-counts-not-server-identity-or-root-cause');
    assert.deepEqual(observation.adbProcesses, [{ pid: 4336, startedAtLocal: 'Thu Oct 22 14:44:09 2026' }]);
    assert.deepEqual(observation.daemonLog.signals, { killServer: 0, serverRestart: 0, transportOffline: 0, writeFailure: 0 });
  }
  assert.equal(report.hostAdbProcessObservationStable, true);
  const diagnostics = json('transfer/adb-sync-trip-change-inputs-diagnostics.json');
  assert(diagnostics.observations.some(row => row.stderr?.includes('device offline')));
  assert.match(diagnostics.observations.find(row => row.id === 'storage-service-log').value, /connection terminated: write failed/);
  const restore = json('ordinary-device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.installAdmin.originalPolicyRestored, true); assert.equal(restore.installAdmin.authorizationRemoved, true);
  assertEvidenceBundleChecksums(base); return report;
}
