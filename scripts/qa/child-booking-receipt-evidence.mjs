import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifyChildBookingReceiptRecords} from './child-booking-receipt-records.mjs';
import {assertBookingReceiptInput} from './booking-receipt-target.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

export const childBookingReceiptFolder = 'docs/release/evidence/child-booking-receipt-recheck-2026-10-30/';
export function assertChildBookingReceiptService(report) {
  assert.equal(report.scope, 'local-genuine-child-booking-receipt-loss-not-search-or-phone-process-restart');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.completed, true); assert.equal(report.failureKind, null); assert.equal(report.sourceFilesUnchanged, true);
  for (const key of ['physicalUiVerified', 'processRestartVerified', 'searchUiVerified', 'productionWrites', 'realPayments', 'releaseComplete'])
    assert.equal(report[key], false, key);
  assert.equal(report.mapRequests, 0); assert.equal(report.adminClientClosed, true); assert.equal(report.firestoreClientTerminated, true);
  assert.equal(report.checks.length, 7); assert(report.checks.every(row => row.status === 'passed'));
  assert.deepEqual(report.checks.map(row => row.id), [
    'real-child-booking-commits-before-first-reply-is-lost',
    'unconfirmed-repeat-is-blocked-without-forwarding-or-changing-records',
    'parent-history-retains-the-original-child-and-two-seats-before-confirmation',
    'fresh-auth-session-reads-the-same-pending-child-booking-without-resubmission',
    'explicit-retry-returns-the-genuine-original-receipt',
    'foreign-parent-cannot-find-or-replay-the-child-booking',
    'original-timestamps-claims-unrelated-records-and-capacity-remain-unchanged',
  ]);
  assertBookingReceiptInput(report.input, report.target, 'sgm-qa-parent', () => report.target.intentRevision);
  const original = report.states.committed;
  assert.deepEqual(Object.keys(report.states).sort(), ['blocked', 'committed', 'final', 'foreign', 'reauthenticated', 'retried', 'unconfirmedHistory'].sort());
  const result = verifyChildBookingReceiptRecords(report.baseline, original, report.target);
  for (const state of Object.values(report.states)) {
    assert.deepEqual(state, original); assert.deepEqual(verifyChildBookingReceiptRecords(report.baseline, state, report.target, result.bookingId), result);
  }
  assert.equal(report.proxy.runId, report.runId); assert.equal(report.proxy.phase, 'recover'); assert.equal(report.proxy.failed, false);
  assert.equal(report.proxy.attempts.length, 3);
  const [first, blocked, retried] = report.proxy.attempts;
  assert.equal(first.phase, 'armed'); assert.equal(first.upstreamAcknowledged, true); assert.equal(first.responseReleased, false);
  assert.equal(blocked.phase, 'lost'); assert.equal(blocked.blockedBeforeForwarding, true); assert.equal(blocked.upstreamAcknowledged, false);
  assert.equal(retried.phase, 'recover'); assert.equal(retried.upstreamAcknowledged, true); assert.equal(retried.responseReleased, true);
  assert.deepEqual(first.commit, retried.commit); assert.equal(first.commit.bookingId, result.bookingId);
  assert.equal(first.commit.clientRequestId, report.input.clientRequestId);
  assert.match(first.requestSha256, /^[a-f0-9]{64}$/); assert.equal(first.requestSha256, retried.requestSha256);
  assert.equal(first.requestSha256, createHash('sha256').update(JSON.stringify(report.input)).digest('hex'));
  const receipt = original.documents.bookingRequestReceipts.find(row => row.data.response?.bookingId === result.bookingId);
  assert.deepEqual(receipt.data.response.trip.bookingIntent, report.input.expectedBookingIntent);
  assert(report.proxy.requests.every(row => !row.failed));
  return result;
}

export function validateChildBookingReceiptEvidence(root) {
  const base = resolve(root, childBookingReceiptFolder), json = file => JSON.parse(readFileSync(resolve(base, file)));
  assertEvidenceBundleChecksums(base);
  const report = json('services.json'), result = assertChildBookingReceiptService(report);
  const scope = json('scope.json'); assert.equal(scope.physicalUiVerified, false); assert.equal(scope.releaseComplete, false);
  assert.equal(scope.productionWrites, false); assert.deepEqual(scope.newPublicMedia, []);
  assertRetainedSourceFiles(root, report.sourceFiles); assertRetainedSourceFiles(root, json('source-sha256.json'));
  const cleanup = json('cleanup.json'); assert.equal(cleanup.commandCompleted, true);
  assert.equal(cleanup.runtimeAbsent, true); assert.equal(cleanup.localEndpointsClosed, true);
  assert.equal(cleanup.productionWrites, false); assert.deepEqual(cleanup.ports, [9099, 8080, 9000, 5001]);
  assert(cleanup.observedAt > report.testedAt);
  const rejected = json('earlier-observer-failure.json'); assert.equal(rejected.completed, false);
  assert.equal(rejected.failureKind, 'AssertionError'); assert.equal(rejected.checks.length, 2);
  assert.equal(rejected.adminClientClosed, true); assert.equal(rejected.firestoreClientTerminated, true);
  return {...result, checks: 7, physicalUiVerified: false};
}

export function validateLatestPreparationDiagnostics(root) {
  const base = resolve(root, childBookingReceiptFolder), read = file => readFileSync(resolve(base, file), 'utf8');
  const json = file => JSON.parse(read(file)); assertEvidenceBundleChecksums(base);
  const job = json('ci/chat-job.json'); assert.equal(job.run_id, 41091421741); assert.equal(job.status, 'completed');
  assert.equal(job.head_sha, 'ef8b99810e45cf126f31e416e22404bcb9f1b7c3'); assert.equal(job.conclusion, 'failure');
  const chatArtifact = json('ci/chat-artifact.json'); assert.equal(chatArtifact.workflow_run.head_sha, job.head_sha);
  assert.equal(chatArtifact.workflow_run.id, job.run_id);
  assert.equal(chatArtifact.digest, 'sha256:8ca0a5730eda8de304c1654d63d6676260cbf7847f7843cac45ee95d6be9c143');
  const chat = json('ci/chat/local-chat-network-ui.json');
  assert.equal(chat.completed, false); assert.equal(chat.failedPhase, 'network-preparation'); assert.deepEqual(chat.network, []);
  assert.equal(chat.wifiRequestReleased, true); assert.equal(chat.cellularRequestReleased, true);
  const active = chat.preparationFailure.capabilityObservation.active;
  assert.deepEqual(active.transports, ['cellular']); assert.equal(active.validated, true);
  const wifi = chat.preparationFailure.capabilityObservation.available.find(row => row.transports.includes('wifi'));
  assert.equal(wifi.validated, false);
  const history = json('ci/chat/chat-network-validation-after.json'); assert.equal(history.newProbesIssued, false);
  const wifiHistory = history.groups.find(row => row.transports.includes('wifi'));
  assert(wifiHistory.events.some(row => row.errorKind === 'dns-resolution'));
  assert(!wifiHistory.events.some(row => row.result === 'http-response' && row.httpStatus === 204));
  assert.match(read('ci/chat/instrumentation.txt'), /ComposeTimeoutException/);
  assert.match(read('ci/chat/instrumentation.txt'), /FAILURES!!!/);
  const restore = json('ci/chat/device-restore.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  const transfer = json('ci/transfer/result.json');
  assert.equal(transfer.completed, false); assert.equal(transfer.success, false); assert.equal(transfer.plannedTrials, 32);
  assert.equal(transfer.trials.length, 29); assert(transfer.trials.slice(0, 28).every(row => row.status === 0 && row.integrityVerified));
  assert.equal(transfer.trials[28].status, 1); assert.equal(transfer.trials[28].integrityVerified, false);
  for (const key of ['appInstalled', 'accountsUsed', 'retryPerformed', 'alternateTransportUsed', 'rootCauseConfirmed', 'releaseAccepted'])
    assert.equal(transfer[key], false, key);
  assert.equal(transfer.cleanup.removed, false); assert.equal(transfer.cleanup.absenceVerified, false);
  const run = json('ci/transport-run.json'); assert.equal(run.headSha, job.head_sha); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const transferArtifact = json('ci/transport-artifact.json'); assert.equal(transferArtifact.workflow_run.head_sha, job.head_sha);
  assert.equal(transferArtifact.workflow_run.id, run.databaseId);
  assert.equal(transferArtifact.digest, 'sha256:6bbab80722300e5939998c1ff6416aa5f00ce3940d774feec38271927ac5215c');
  const native = json('ci/native-run.json'); assert.equal(native.headSha, job.head_sha); assert.equal(native.status, 'completed');
  assert.equal(native.conclusion, 'failure'); assert.equal(native.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'success');
  const main = json('ci/main/results.json'); assert.equal(main.scope, 'local-ui-not-physical-device');
  assert.equal(main.testCount, 37); assert.equal(main.nativeCaseCount, 40); assert.equal(main.steps.length, 37);
  assert(main.steps.every(row => row.status === 'passed')); assert.equal(main.adminClientClosed, true); assert.equal(main.firestoreClientTerminated, true);
  const primary = Object.keys(json('artifact-sha256.json')).filter(file => file.startsWith('ci/main/adb-pull-'));
  assert.equal(primary.length, 17);
  for (const file of primary) {const copy = json(file); assert.equal(copy.runId, main.runId); assert.equal(copy.completed, true); assert.equal(copy.status, 0);}
  const parsed = parseAndroidJUnitTranscript(read('ci/main/ordinary-instrumentation.txt'));
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(json('ci/main/ordinary-results.json')[key], value);
  assert.equal(parsed.passed, 205); assert.equal(parsed.skipped, 54); assert.equal(parsed.failed, 0);
  assert.deepEqual(json('ci/main/native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const mainNetwork = json('ci/main/local-chat-network-ui.json'); assert.equal(mainNetwork.completed, true);
  assert.deepEqual(mainNetwork.initialNetwork.capabilityObservation.active.transports, ['wifi']);
  assert.equal(mainNetwork.initialNetwork.capabilityObservation.active.validated, true);
  assert.equal(json('ci/main/disposable-store-restore.json').verified, true);
  const artifact = json('ci/main-artifact.json'); assert.equal(artifact.workflow_run.head_sha, job.head_sha); assert.equal(artifact.workflow_run.id, native.databaseId);
  assert.equal(artifact.digest, 'sha256:52f4f35b65f44b909dc6ca306b07e5731c301f62c83a4d21e4e950cb7758d922');
  return {chatPreparationPassed: false, generatedTransfersPassed: 28, generatedTransferFailed: 1, rootCauseConfirmed: false};
}
