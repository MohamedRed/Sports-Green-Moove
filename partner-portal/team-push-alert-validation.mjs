import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const teamPushAlertFolder='docs/release/evidence/team-push-alert-authorization-2026-11-01/';
const ids=[
  'authentication-and-strict-request-reject-caller-selected-owner-content-and-route',
  'display-and-open-return-only-generic-copy-and-current-team-reference-without-reads-or-writes',
  'unknown-installation-wrong-proof-stale-revision-and-foreign-device-owner-are-denied',
  'foreign-alert-and-missing-alert-have-identical-empty-responses',
  'read-alert-is-not-redisplayed-but-authorized-open-remains-possible-without-message-acknowledgement',
  'token-rotation-rejects-old-attempt-but-current-revision-can-resolve-an-existing-opaque-alert',
  'account-switch-rejects-the-old-owner-and-cannot-expose-that-owners-alert-to-the-new-account',
  'signout-tombstone-blocks-both-stale-and-current-revision-resolution-until-explicit-registration',
  'missing-conflicting-or-malformed-token-index-and-corrupt-registration-fail-closed',
  'current-child-claims-disabled-state-child-profile-and-child-link-override-a-stale-adult-login',
  'forged-alert-identity-private-copy-missing-message-and-self-message-never-resolve',
  'guardian-revocation-suppresses-both-purposes-and-new-verification-cannot-recover-old-history',
  'adult-and-child-current-club-memberships-are-rechecked-before-display-and-open',
  'manager-revocation-and-reapproval-start-a-new-history-boundary',
  'closed-or-recreated-team-never-resolves-a-previous-instance-alert',
  'unrelated-fixtures-and-accounts-are-unchanged-no-message-receipts-or-provider-sends',
];
export function validateTeamPushAlertAuthorization(root,folder=teamPushAlertFolder){
  const base=resolve(root,folder);assertEvidenceBundleChecksums(base);
  const report=JSON.parse(readFileSync(resolve(base,'services.json')));
  assert.deepEqual(Object.keys(report).sort(),['projectId','runId','testedAt','scope','completed','steps','isolation',
    'adminClientClosed','firestoreClientTerminated','physicalDevice','nativeUiExecuted','pushDeliveryVerified',
    'realPhoneTokenRegistered','providerRequests','productionWrites','mapRequests','realPayments','sourceFiles',
    'isolatedEnvironmentDestroyed','emulatorEndpoints'].sort());
  assert.match(report.runId,/^[a-f0-9]{32}$/);assert(Number.isFinite(Date.parse(report.testedAt)));
  assert.equal(report.projectId,'demo-sgm-local-qa');assert.equal(report.testedAt.slice(0,10),'2026-11-01');
  assert.equal(report.scope,'isolated-alert-authorization-not-native-display-or-provider-delivery');
  assert.deepEqual(report.steps,ids.map(id=>({id,status:'passed'})));
  for(const key of ['completed','adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])
    assert.equal(report[key],true,key);
  assert.equal(report.isolation.protectedBaselinePreserved,true);
  assert.deepEqual(report.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  for(const key of ['physicalDevice','nativeUiExecuted','pushDeliveryVerified','realPhoneTokenRegistered','productionWrites','realPayments'])
    assert.equal(report[key],false,key);
  for(const key of ['providerRequests','mapRequests'])assert.equal(report[key],0,key);
  for(const file of ['functions/src/domain/teamPushAlert.ts','functions/src/services/teamPushAlert.ts',
    'functions/src/callables/teamPushAlert.ts','functions/src/services/teamNotificationAccess.ts',
    'functions/src/services/teamConversationAuthority.ts','functions/src/services/teamConversationAccounts.ts',
    'scripts/qa/local-team-push-alert-suite.mjs','scripts/qa/run-local-team-conversation.mjs'])assert(report.sourceFiles[file],file);
  assertRetainedSourceFiles(root,report.sourceFiles);
  return report;
}
