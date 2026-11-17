import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {supportRecoveryPhases, verifySupportRecoveryCheckpoint} from './manual-support-recovery-checkpoints.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const supportRecheckFolder = 'docs/release/evidence/support-recovery-recheck-2026-10-30/';
export const supportRecheckHead = 'a1d0d9616c1b2f6db0e9e86b117fd6c81db97adc';

export function assertSupportRecheckScope(report) {
  assert.equal(report.scope, 'physical-support-retry-after-controlled-offline-and-process-stop-not-radio-or-release-proof');
  assert.equal(report.sourceCommit, supportRecheckHead); assert.equal(report.checkedAt, '2026-10-30');
  assert.equal(report.apkSha256, '3837331ce85b2cddadc39145f6ae2713f504ac590114a7c97d89763a3adc6642');
  for (const key of ['physicalDevice', 'nativeProcessStopVerified', 'draftRestoredWithoutRetyping', 'explicitRetryObserved',
    'originalReportUnchanged', 'accountIsolationObserved', 'controlledOfflineObserved', 'hostDisposalVerified']) assert.equal(report[key], true, key);
  for (const key of ['physicalRadioLossVerified', 'trackingNetworkLossVerified', 'urgentEscalationVerified', 'realEmailSent',
    'earlierReplayRootCauseEstablished', 'handlerClosedBeforeReleaseVerified', 'installedBytesIndependentlyHashed',
    'fullCiPassed', 'releaseComplete', 'productionWrites', 'videoRecorded', 'iosPhysicalUiVerified']) assert.equal(report[key], false, key);
  assert.deepEqual(report.publishedCaptures, {'support-recheck-history': 'captures/10-parent-history-session.png'});
  return report;
}

export function validateSupportRecheck(root) {
  const base = resolve(root, supportRecheckFolder), read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file)), report = assertSupportRecheckScope(json('summary.json'));
  assertEvidenceBundleChecksums(base); assertRetainedSourceFiles(root, json('source-sha256.json'));
  const controller = json('checkpoints/session-results.json');
  assert.equal(controller.scope, 'independent-support-recovery-record-checkpoints-not-phone-network-proof');
  assert.equal(controller.completed, true); assert.equal(controller.adminClientClosed, true);
  for (const key of ['productionWrites', 'physicalNetworkStateVerifiedByController', 'processIdentityVerified', 'fixtureEnvironmentDestroyed'])
    assert.equal(controller[key], false, key);
  assert.equal(controller.protectedRecordCount, 158);
  assert.deepEqual(controller.checkpoints.map(row => row.phase), supportRecoveryPhases);
  const checkpoints = supportRecoveryPhases.map((phase, index) => {
    const row = json(`checkpoints/${phase}.json`);
    assert.equal(row.runId, controller.runId); assert.equal(row.projectId, 'demo-sgm-local-qa');
    assert.equal(row.protectedRecordCount, 158); assert.equal(row.originalClaimsUnchanged, true);
    assert.deepEqual(verifySupportRecoveryCheckpoint(phase, row.state, row.fixture), row.result);
    assert.deepEqual(row.result, controller.checkpoints[index]); return row;
  });
  assert(checkpoints.every((row, index) => index === 0 || row.recordedAt > checkpoints[index - 1].recordedAt));
  assert.deepEqual(checkpoints.at(-1).state.attempts.toSorted((a, b) => a.recordedAt.localeCompare(b.recordedAt)).map(row => row.receipt.reused), [false, true]);
  const held = json('gate/held.json'), released = json('gate/released.json'), observations = json('observations.json');
  assert.equal(held.runId, controller.runId); assert.equal(released.runId, controller.runId);
  assert.equal(released.handlerClosedBeforeReleaseAt, null); assert.equal(released.receiptUnchanged, true);
  assert(held.recordedAt < observations.offlineCaptureFileModifiedAt && observations.offlineCaptureFileModifiedAt < released.releasedAt);
  assert.equal(observations.networkMethod, 'provider-offline-mode-0kbps-not-persistent-wifi-disable');
  assert.equal(observations.parentHistoryRows, 2); assert.equal(observations.newReports, 1);
  assert.equal(observations.preexistingProtectedReports, 1); assert.equal(observations.newVideo, false);
  assert.match(read('process/before.txt'), /MEMINFO in pid 15956 \[be.sportgreenmoove.app.local\]/);
  assert.match(read('process/stopped.txt'), /No process found for: be.sportgreenmoove.app.local/);
  assert.match(read('process/reopened.txt'), /MEMINFO in pid 20346 \[be.sportgreenmoove.app.local\]/);
  assert.match(read('process/package-removed.txt'), /Unable to find package: be.sportgreenmoove.app.local/);
  const closure = json('ui-closure.json'), disposal = json('host-disposal.json');
  for (const key of ['packageAbsent', 'deviceSessionStopped', 'networkSimulationRestoredObserved', 'clipboardReplacedWithNonSensitiveText',
    'desktopClipboardRestored', 'keySettingMasked']) assert.equal(closure[key], true, key);
  for (const key of ['temporaryDeviceAdminAdded', 'installedBytesIndependentlyHashed', 'videoRecorded', 'productionWrites']) assert.equal(closure[key], false, key);
  for (const key of ['sessionFileRemoved', 'runtimeRootRemoved', 'observedRuntimeProcessesAbsent', 'vendorProcessAbsent',
    'privateHelperDirectoryRemoved', 'listenersAbsent']) assert.equal(disposal[key], true, key);
  assert.deepEqual(disposal.ports, [9099, 5001, 8080, 9000, 4400, 4500]);
  assert.equal(json('apk-binding.json').sourceCommit, supportRecheckHead);
  assert.equal(json('apk-binding.json').sha256, report.apkSha256);
  assert.match(read('build.txt'), /BUILD SUCCESSFUL/);
  const capture = imageSize(readFileSync(resolve(base, report.publishedCaptures['support-recheck-history'])));
  assert.equal(capture.width, 198); assert.equal(capture.height, 435);
  return report;
}

export function validateSupportRecheckCi(root) {
  const base = resolve(root, supportRecheckFolder), read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file)), run = json('ci/native-run.json');
  assertEvidenceBundleChecksums(base);
  assert.equal(run.headSha, supportRecheckHead); assert.equal(run.databaseId, 41079831206);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'failure');
  const focused = run.jobs.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ') && !row.name.endsWith(' / Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const parsed = parseAndroidJUnitTranscript(read('ci/ordinary-instrumentation.txt'));
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(json('ci/ordinary-results.json')[key], value);
  assert.equal(parsed.passed, 205); assert.equal(parsed.skipped, 54); assert.equal(parsed.failed, 0);
  assert.deepEqual(json('ci/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const hashes = json('artifact-sha256.json');
  const transcripts = Object.keys(hashes).filter(file => file.startsWith('ci/replay/') && file.endsWith('-instrumentation.txt'));
  assert.equal(transcripts.length, 17);
  for (const file of transcripts) assertInstrumentationPassed(read(file), file.includes('LocalAppFlowTest-') ? 9 : 1);
  assert(!Object.hasOwn(hashes, 'ci/replay/results.json'), 'Unexecuted replay remainder is not a completed matrix');
  const failed = json('ci/replay/adb-pull-trip-change-parent-confirmation.json');
  assert.equal(failed.phase, 'trip-change-parent-confirmation'); assert.equal(failed.completed, false); assert.equal(failed.status, 1);
  assert.equal(failed.runId, 'f6aa1e22b9e6372e50cfc4149eec57d1');
  const cleanup = json('ci/replay/adb-pull-failure-cleanup.json'); assert.equal(cleanup.completed, true);
  assert.notDeepEqual(cleanup, failed, 'Cleanup copy cannot replace failed primary transfer');
  const restoration = json('ci/disposable-store-restore.json'); assert.equal(restoration.verified, true); assert.equal(restoration.restored, true);
  const artifact = json('ci/artifact.json'); assert.equal(artifact.workflow_run.head_sha, supportRecheckHead);
  assert.equal(artifact.workflow_run.id, run.databaseId);
  assert.equal(artifact.digest, 'sha256:dc7fa8f56585f82cffc913b98de42f0579e46c2bc0ec683d183b22a8ef6671ef');
  const web = json('ci/web-run.json'); assert.equal(web.headSha, supportRecheckHead);
  assert.equal(web.status, 'completed'); assert.equal(web.conclusion, 'cancelled');
  assert.equal(web.jobs.find(row => row.name === 'Functions, admin, and website checks').conclusion, 'cancelled');
  assert.equal(web.jobs.find(row => row.name === 'Functions, admin, and website smoke').conclusion, 'failure');
  return {ordinaryPassed: 205, focusedJobs: 11, observedReplayTranscripts: 17, fullGatePassed: false};
}
