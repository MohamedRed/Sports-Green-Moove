import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const invitationConnectionRecheckFolder = 'docs/release/evidence/invitation-connection-recheck-2026-10-31/';
export function assertInvitationConnectionRecheck(review) {
  assert.equal(review.scope, 'fresh-phone-loopback-refusal-with-live-host-observation-not-signup-or-root-cause-proof');
  assert.equal(review.sourceCommit, 'ecd9b67058378f28e9be27a64fa771e2e13bdb7b');
  assert.equal(review.projectId, 'demo-sgm-local-qa'); assert.equal(review.runId, 'f3e1b7d6e1b4a972cf7ac37d27ce7c22');
  assert.equal(review.testedAt, '2026-10-31'); assert.equal(review.physicalPhoneObserved, true);
  assert.equal(review.phoneModel, 'Google Pixel 9 Pro'); assert.equal(review.osVersion, '15.0');
  assert.equal(review.selectedApkSha256, 'f707cb41e5b59147acc9e94c69115edbe6dc95c528b52586fb36c83eefe524e8');
  assert.equal(review.approvedExtraLoopbackPort, 4185); assert.equal(review.browserLoopbackRequestsRefused, 2);
  assert.equal(review.phoneError, 'ERR_CONNECTION_REFUSED'); assert.equal(review.helperObservedAfterErrors, true);
  for (const key of ['installedApkIndependentlyHashed','browserFormReached','childAccountCreated','parentApprovalProven',
    'nativeShareToSignupProven','helperConnectionContinuityProven','rootCauseConfirmed','browserAliasEnabled',
    'resolveAllUrlsEnabled','requestLoggingEnabled','productionWrites','realPayments','videoRecorded','releaseComplete'])
    assert.equal(review[key], false, key);
  assert.equal(review.mapRequests, 0); assert.equal(review.publicCapturesAdded, 0);
}
export function validateInvitationConnectionRecheck(root) {
  const folder=resolve(root, invitationConnectionRecheckFolder), bytes=file=>readFileSync(resolve(folder,file));
  const json=file=>JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const review=json('review.json'); assertInvitationConnectionRecheck(review);
  const before=json('observations.json'), records=json('connection-blocked-records.json'), disposal=json('disposal.json');
  for (const item of [before,records,disposal]) {
    assert.equal(item.projectId, review.projectId); assert.equal(item.runId, review.runId);
  }
  assert.deepEqual(before.observations.map(row=>row.phase), ['before']);
  assert.equal(before.accountCreatedThroughBrowser, false); assert.equal(before.observations[0].userCount, 3);
  assert.equal(before.applicationHead, review.sourceCommit);
  assert.equal(records.accountCount, 3); assert.equal(records.invitationStatus, 'pending');
  for (const key of ['redemptionCount','approvalRequestCount','accountLinkCount']) assert.equal(records[key], 0);
  for (const key of ['childAccountExists','browserFormReached','signupProven','parentApprovalProven','productionWrites','releaseComplete'])
    assert.equal(records[key], false, key);
  assert.deepEqual(records.claims, [
    {uid:'sgm-qa-club-manager',claims:{roleKeys:['clubManager','parent']}},
    {uid:'sgm-qa-driver',claims:{roleKeys:['driver','parent']}}, {uid:'sgm-qa-parent',claims:{roleKeys:['parent']}},
  ]);
  assert.equal(records.adminClientClosed, true); assert.equal(records.firestoreClientTerminated, true);
  for (const key of ['processGroupExited','isolatedEnvironmentDestroyed','privatePhoneSessionAbsent','privateSignupInputAbsent'])
    assert.equal(disposal[key], true, key);
  assert.equal(disposal.failed, false); assert.deepEqual(disposal.emulatorEndpoints,
    {host:'127.0.0.1',ports:[9099,8080,9000,5001,4185],closed:true});
  const host=json('host-entry-check.json'); assert.equal(host.scope, 'host-entry-not-phone-connectivity-proof');
  assert.deepEqual(host.rows, ['127.0.0.1','localhost'].map(name=>({host:name,port:4185,status:302,
    redirectPath:'/child-invitation',invitationFragmentPresent:true,invitationFragmentRetained:false})));
  const helper=json('helper-after-errors.json');
  assert.equal(helper.scope, 'host-process-and-listener-observation-not-end-to-end-tunnel-proof');
  assert.deepEqual(helper.processRows, [{pid:8528,ppid:8411,state:'S'},{pid:8534,ppid:8528,state:'S'}]);
  assert.equal(helper.localPageListenerObserved, true); assert.equal(helper.helperListenerObserved, true);
  assert.equal(helper.networkSettingsChanged, false); assert.equal(helper.rootCauseConfirmed, false);
  const phone=json('phone-and-helper-disposal.json');
  for (const key of ['providerDashboardObserved','sessionStopped','hostClipboardRestored','helperRequestedStop',
    'helperGroupExitVerified','helperProcessesAbsent','helperDirectoryAbsent','temporaryPagePortClosed','allSelectedServiceListenersClosed'])
    assert.equal(phone[key], true, key);
  for (const key of ['uninstallSucceeded','independentPackageAbsenceProven','parentSignedIn','childSignedIn',
    'devicePolicyChanged','hostBrowserPermissionChanged']) assert.equal(phone[key], false, key);
  assert.equal(phone.helperExitCode, 130); assert.equal(phone.hostAppsOnDevicePermissionObserved, 'on');
  assert.equal(phone.uninstallResponse, 'No user apps found to uninstall.');
  assert.match(bytes('uninstall-result-ax.txt').toString(), /No user apps found to uninstall/);
  assert.match(bytes('local-settings-ax.txt').toString(), /Resolve all URLs through my network, Value: 0/);
  for (const file of ['01-loopback-refused.jpg','02-localhost-refused.jpg']) {
    const size=imageSize(bytes('captures/'+file)); assert.equal(size.type, 'jpg');
    assert.equal(size.width,1200); assert.equal(size.height,596);
  }
  assertRetainedSourceFiles(root,json('source-files.json')); assertRetainedSourceFiles(root,before.sourceFiles);
  return {formReached:false,accountsCreated:0,parentApprovalProven:false,temporaryPortClosed:true,releaseComplete:false};
}
