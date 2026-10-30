import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const invitationConnectionFolder = 'docs/release/evidence/invitation-phone-connection-2026-10-30/';
export const nativeCapacityFolder = 'docs/release/evidence/native-capacity-e64555e-2026-10-30/';
const json = path => JSON.parse(readFileSync(path));
export function assertInvitationConnectionFailure(summary, observation, records, disposal, phone) {
  assert.equal(summary.scope, 'physical-android-browser-connection-refused-before-signup-not-product-or-root-cause-proof');
  assert.equal(observation.projectId, 'demo-sgm-local-qa'); assert.equal(observation.runId, records.runId);
  assert.equal(summary.runId, records.runId); assert.equal(disposal.runId, records.runId);
  assert.deepEqual(observation.observations.map(row => row.phase), ['before']);
  assert.equal(records.accountCount, 3); assert.equal(records.invitationStatus, 'pending');
  for (const key of ['redemptionCount', 'approvalRequestCount', 'accountLinkCount']) assert.equal(records[key], 0);
  for (const key of ['childAccountExists', 'browserFormReached', 'signupProven', 'parentApprovalProven', 'productionWrites', 'releaseComplete'])
    assert.equal(records[key], false, key);
  assert.equal(records.adminClientClosed, true); assert.equal(records.firestoreClientTerminated, true);
  assert.deepEqual(records.claims, [
    {uid: 'sgm-qa-club-manager', claims: {roleKeys: ['clubManager', 'parent']}},
    {uid: 'sgm-qa-driver', claims: {roleKeys: ['driver', 'parent']}},
    {uid: 'sgm-qa-parent', claims: {roleKeys: ['parent']}},
  ]);
  for (const key of ['browserFormReached', 'childAccountCreated', 'parentApprovalProven', 'nativeShareToSignupProven',
    'productionWrites', 'realPayments', 'resolveAllUrlsEnabled', 'browserAliasEnabled', 'helperExitTimeKnown',
    'helperConnectionContinuityProven', 'videoRecorded', 'independentPackageAbsenceProven', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(summary.approvedExtraLoopbackPort, 4185); assert.equal(summary.browserLoopbackRequestsRefused, 2);
  assert.equal(summary.publicCapturesAdded, 0); assert.equal(summary.mapRequests, 0);
  assert.equal(summary.helperExitedWithoutRequestedStop, true); assert.equal(summary.helperExitCode, 0);
  assert.equal(summary.helperGroupExitVerified, true); assert.equal(summary.helperDirectoryAbsent, true);
  assert.equal(disposal.failed, false); assert.equal(disposal.processGroupExited, true);
  assert.equal(disposal.isolatedEnvironmentDestroyed, true); assert.equal(disposal.privatePhoneSessionAbsent, true);
  assert.equal(disposal.privateSignupInputAbsent, true); assert.equal(disposal.emulatorEndpoints.closed, true);
  assert.deepEqual(disposal.emulatorEndpoints.ports, [9099, 8080, 9000, 5001, 4185]);
  assert.equal(phone.providerIdleObserved, true); assert.equal(phone.hostClipboardRestored, true);
  for (const key of ['uninstallAcknowledged', 'independentPackageAbsenceProven', 'uninstallConfirmationCompleted',
    'temporaryDeviceAdministratorUsed', 'devicePolicyChanged']) assert.equal(phone[key], false, key);
}
export function validateInvitationConnectionFailure(root) {
  const base = resolve(root, invitationConnectionFolder), get = file => json(resolve(base, file + '.json'));
  assertEvidenceBundleChecksums(base);
  assertInvitationConnectionFailure(get('summary'), get('observations'), get('connection-blocked-records'), get('disposal'), get('phone-disposal'));
  assertRetainedSourceFiles(root, get('source-files')); assertRetainedSourceFiles(root, get('observations').sourceFiles);
  for (const phase of ['127-loopback-refused', 'localhost-refused']) {
    const crop = imageSize(readFileSync(resolve(base, phase + '-phone.png'))), original = imageSize(readFileSync(resolve(base, phase + '.jpg')));
    assert.equal(crop.type, 'png'); assert.equal(crop.width, 254); assert.equal(crop.height, 564);
    assert.equal(original.width, 1440); assert.equal(original.height, 722);
    assert.deepEqual(get(phase).crop, {left: 625, top: 107, width: 254, height: 564});
  }
  return {formReached: false, signupCompleted: false, accountsCreated: 0, capturesPublished: 0, releaseComplete: false};
}
export function validateNativeCapacityFailure(root) {
  const base = resolve(root, nativeCapacityFolder), get = file => json(resolve(base, file + '.json'));
  assertEvidenceBundleChecksums(base);
  const summary = get('summary'), run = get('run'), job = get('job'), checks = get('pr-checks');
  assert.equal(summary.sourceCommit, 'e64555e7d8c2d23b34bc05e2e952625a6c44ca05');
  assert.equal(run.head_sha, summary.sourceCommit); assert.equal(checks.headRefOid, summary.sourceCommit);
  assert.equal(run.id, 41120151150); assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(job.id, 124284519409); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(row => row.conclusion === 'failure').name, 'Run Android Compose UI tests');
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  const focused = checks.statusCheckRollup.filter(row => row.name.startsWith('Android focused safety UI tests / Isolated ')
    && !row.name.endsWith('/ Isolated safety flows'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'SUCCESS'));
  assert.equal(summary.availableMb, 6926.72); assert.equal(summary.requiredMb, 7372.80); assert(summary.availableMb < summary.requiredMb);
  assert.equal(summary.acceptedTestCases, 0);
  for (const key of ['emulatorStarted', 'appUiExecuted', 'capacityCorrectionExecutedOnHostedRunner', 'earlierTransferRootCauseProven', 'releaseComplete'])
    assert.equal(summary[key], false, key);
  const excerpt = readFileSync(resolve(base, 'boot-failure-excerpt.txt'), 'utf8');
  assert.match(excerpt, /FATAL.*Available: 6926\.72 MB.*need 7372\.80 MB/); assert.match(excerpt, /Timeout waiting for emulator to boot/);
  return {failurePhase: 'emulator-capacity-before-tests', acceptedTestCases: 0, releaseComplete: false};
}
