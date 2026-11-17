import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {matrixPackages} from './android-case-apks.mjs';

export const matrix964Folder = 'docs/release/evidence/native-matrix-9640d8b-2026-11-06';
export const matrix964Identity = {source: '9640d8b65db123e753d1577eebd2e67595f16058', run: 42273698362,
  job: 128084475317, artifact: 13535290752, bytes: 33157663,
  sha256: '3d9b16b06689f3fe17bd757be2e2b4e2a08b7be9780504467af6f5df2fb04f4b',
  session: '720a51b721240066395690578a7979fb'};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const expectedSteps = ['parent-app-ui', 'driver-approval-ui', 'landscape-login-ui', 'calendar-empty-consent-ui', 'theme-process-restart-ui',
  'ride-lifecycle-ui', 'ride-review-ui', 'ride-ledgers-ui', 'chat-conversation-ui', 'chat-directory-ui', 'search-input-ui',
  'search-session-ui', 'search-criteria-ui', 'search-retention-ui', 'multi-seat-sdk', 'reservation-decisions-ui', 'membership-refresh-ui',
  'chat-network-recovery-ui', 'chat-account-switch-ui', 'chat-confirmed-process-restart-ui', 'chat-post-commit-response-loss-ui',
  'driver-trip-cancellation-ui', 'booking-post-commit-response-loss-sdk', 'booking-response-loss-search-ui', 'trip-change-parent-confirmation-ui',
  'trip-change-inputs-ui', 'trip-change-schedule-ui', 'trip-consent-process-restart-ui', 'trip-consent-pending-restart-ui',
  'trip-consent-partial-restart-ui', 'trip-consent-declined-restart-ui', 'trip-consent-withdrawn-restart-ui', 'trip-draft-process-restart-ui',
  'guardian-parent-ui', 'emergency-contact-ui', 'team-enrollment-ui', 'notification-read-process-restart-ui'];

export function validateMatrix964Evidence(root) {
  const base = resolve(root, matrix964Folder), bytes = file => readFileSync(resolve(base, file)), json = file => JSON.parse(bytes(file));
  const report = json('summary.json'), identity = matrix964Identity, hashes = json('artifact-sha256.json');
  for (const [file, hash] of Object.entries(hashes)) {
    assert.match(file, /^[A-Za-z0-9#_.\/-]+$/); assert(!file.startsWith('/') && !file.split('/').includes('..'));
    assert.match(hash, /^[a-f0-9]{64}$/); assert.equal(sha(bytes(file)), hash, file);
  }
  const archive = json('original-archive.json'), metadata = json('artifact-metadata.json'), run = json('native-run.json');
  assert.equal(archive.bytes, identity.bytes); assert.equal(archive.sha256, identity.sha256); assert.equal(archive.artifactId, identity.artifact);
  assert.equal(metadata.id, identity.artifact); assert.equal(metadata.size_in_bytes, identity.bytes);
  assert.equal(metadata.digest, 'sha256:' + identity.sha256); assert.equal(metadata.workflow_run.head_sha, identity.source);
  assert.equal(metadata.workflow_run.id, identity.run); assert.equal(run.headSha, identity.source); assert.equal(run.databaseId, identity.run);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'cancelled');
  const job = run.jobs.find(row => row.databaseId === identity.job);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  for (const name of ['Run Android Compose UI tests', 'Finish bounded read-only full-matrix host observation', 'Upload Android instrumentation reports'])
    assert.equal(job.steps.find(row => row.name === name)?.conclusion, 'success');
  const seen = new Set();
  for (const row of archive.members) {
    assert(!seen.has(row.file)); seen.add(row.file); assert(Object.hasOwn(hashes, row.file));
    assert.equal(bytes(row.file).length, row.bytes); assert.equal(sha(bytes(row.file)), row.sha256);
  }
  const required = ['ordinary-results.json', 'ordinary-instrumentation.txt', 'ordinary-tests.xml', 'replay-results.json',
    'suite-status.json', 'device-setup.json', 'device-restoration.json', 'host-exit.json', 'matrix-manifest.json',
    'host-dns-before-launch.json', 'capture-collection.json'];
  for (const file of ['summary.json', 'original-archive.json', 'artifact-metadata.json', 'native-run.json']) assert(Object.hasOwn(hashes, file));
  assert.equal(archive.members.length, 60); assert.equal(Object.keys(hashes).length, 64);
  for (const file of required) assert(seen.has(file), file);
  assert.deepEqual(json('suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const setup = json('device-setup.json'), ordinary = json('ordinary-results.json'), replay = json('replay-results.json');
  assert.equal(setup.case, 'full-matrix'); assert.equal(setup.scope, 'single-case-continuous-installation-guard-not-flow-proof');
  assert.deepEqual(Object.keys(setup.apkHashes).sort(), Object.keys(matrixPackages).sort());
  assert.deepEqual(Object.fromEntries(json('matrix-manifest.json').copies.map(row => [row.applicationId, row.sha256])), setup.apkHashes);
  for (const row of json('matrix-manifest.json').copies) assert.equal(row.isolated, row.applicationId.includes('.local'));
  for (const preparation of [ordinary.preparation, replay.matrixPreparation]) {
    assert.deepEqual(preparation.apkHashes, setup.apkHashes); assert.equal(preparation.receiptSha256, sha(bytes('device-setup.json')));
    assert.equal(preparation.installationsRemainedBlocked, true);
  }
  const parsed = parseAndroidJUnitTranscript(bytes('ordinary-instrumentation.txt').toString());
  for (const [key, value] of Object.entries(parsed)) assert.deepEqual(ordinary[key], value);
  assert.deepEqual([parsed.caseCount, parsed.passed, parsed.skipped, parsed.failed], [354, 299, 55, 0]);
  assert.equal(ordinary.physicalDeviceAccepted, false); assert.equal(ordinary.productionWritesAccepted, false);
  const xml = new XMLParser({ignoreAttributes: false}).parse(bytes('ordinary-tests.xml')).testsuite;
  assert.deepEqual([Number(xml['@_tests']), Number(xml['@_failures']), Number(xml['@_skipped'])], [354, 0, 55]);
  assert.deepEqual(xml.testcase.map(row => [row['@_classname'], row['@_name']]), parsed.cases.map(row => [row.className, row.name]));
  assert.equal(replay.projectId, 'demo-sgm-local-qa'); assert.equal(replay.scope, 'local-ui-not-physical-device');
  assert.equal(replay.runId, identity.session); assert.equal(replay.testCount, 37); assert.equal(replay.nativeCaseCount, 40);
  assert.deepEqual(replay.steps, expectedSteps.map(id => ({id, status: 'passed'})));
  for (const key of ['ride', 'chat', 'directory', 'multiSeatSdk', 'reservationDecisions', 'tripCancellation', 'tripChanges',
    'tripChangeInputs', 'tripSchedule', 'guardianParent', 'emergencyContact', 'teamEnrollment', 'notificationRead',
    'tripConsentRestart', 'tripConsentRecovery', 'tripDraftRestart', 'tripScheduleDraftRestart', 'membershipRefresh',
    'chatNetwork', 'chatRestart', 'chatResponseLoss', 'bookingResponseLoss', 'bookingUiResponseLoss', 'search'])
    assert(replay[key] && typeof replay[key] === 'object' && Object.keys(replay[key]).length > 0, key);
  assert.equal(replay.adminClientClosed, true); assert.equal(replay.firestoreClientTerminated, true);
  const transcripts = readdirSync(resolve(base, 'instrumentation')); assert.equal(transcripts.length, 32);
  let count = 0;
  for (const name of transcripts) {
    assert(seen.has('instrumentation/' + name)); const text = bytes('instrumentation/' + name).toString();
    assert.match(text, /^INSTRUMENTATION_STATUS: sgm_installations_blocked=true\r?\nINSTRUMENTATION_STATUS_CODE: 0/m);
    const matches = [...text.matchAll(/OK \((\d+) tests?\)/g)]; assert.equal(matches.length, 1);
    const cases = Number(matches[0][1]); assertInstrumentationPassed(text, cases); count += cases;
  }
  assert.equal(count, 40);
  const copies = readdirSync(resolve(base, 'copies')); assert.equal(copies.length, 17);
  for (const name of copies) {
    assert(seen.has('copies/' + name)); const copy = json('copies/' + name);
    assert.equal(copy.runId, identity.session); assert.equal(copy.completed, true); assert.equal(copy.status, 0);
    assert.equal(copy.signal, null); assert.equal(copy.errorCode, null);
    assert.match(String(copy.stdout) + '\n' + String(copy.stderr), /[1-9]\d* files? pulled, 0 skipped\.[^\n]*\([1-9]\d* bytes in/);
  }
  const restore = json('device-restoration.json'); assert.equal(restore.restored, true); assert.equal(restore.verified, true);
  assert.equal(restore.observed.continuousGuardVerified, true);
  for (const key of ['localPackagesRemoved', 'background', 'stopped', 'launcher']) assert.equal(restore.restoration[key], true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restore.restoration.installAdmin[key], true);
  const host = json('host-exit.json'); assert.equal(host.targetExitObserved, true); assert.equal(host.finalState, 'gone');
  assert.equal(host.processSignalsRequested, false); assert.equal(host.deviceCommandsRequested, false);
  const collection = json('capture-collection.json'); assert.equal(collection.ok, true); assert.equal(collection.ordinaryPassed, true);
  assert.equal(report.sourceCommit, identity.source); assert.equal(report.checkedAt, '2026-11-06');
  assert.equal(report.nativeJobPassed, true); assert.equal(report.localFlowGroupsPassed, 37); assert.equal(report.nativeReplayCasesPassed, 40);
  for (const key of ['wholeWorkflowPassed', 'currentHeadAccepted', 'physicalDeviceAccepted', 'rootCauseConfirmed',
    'ordinaryStopCandidateAccepted', 'safetyAuditAccepted', 'newMediaPublished', 'releaseComplete']) assert.equal(report[key], false);
  return report;
}
