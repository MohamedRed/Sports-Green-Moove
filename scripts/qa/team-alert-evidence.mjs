import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const teamAlertEvidence='docs/release/evidence/team-alert-services-2026-11-01/services.json';
export function validateTeamAlertRun(run) {
  assert.equal(run.projectId,'demo-sgm-local-qa');assert.match(run.runId,/^[a-f0-9]{32}$/);
  assert.equal(run.scope,'local-team-alerts-and-pending-push-envelope-not-native-or-push-delivery');
  assert(Number.isFinite(Date.parse(run.testedAt)));
  for(const key of ['completed','adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])assert.equal(run[key],true,key);
  for(const key of ['physicalDevice','nativeUiExecuted','pushDeliveryVerified','phoneTokenRegistered','productionWrites','realPayments'])
    assert.equal(run[key],false,key);
  assert.equal(run.providerRequests,0);assert.equal(run.mapRequests,0);
  assert.deepEqual(run.isolation,{protectedBaselinePreserved:true});
  assert.deepEqual(run.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  const expected=[
    'concurrent-send-creates-two-eligible-generic-alerts-and-one-pending-push-envelope',
    'sender-unverified-parent-child-claims-child-profile-linked-login-disabled-and-club-only-manager-excluded',
    'same-intent-retry-and-conflicting-content-never-duplicate-alerts-or-push-envelope',
    'inbox-alert-is-visible-and-owned-alert-read-does-not-acknowledge-team-message',
    'push-envelope-is-not-readable-by-a-recipient-through-client-database-access',
    'guardian-revocation-and-new-verification-hide-earlier-alerts-and-reject-old-read-requests',
    'newly-verified-parent-receives-only-subsequent-alerts',
    'excessive-audience-rejects-before-any-message-alert-or-push-envelope-write',
    'two-qualifying-children-do-not-duplicate-a-parent-alert',
    'one-qualifying-child-preserves-access-and-removing-the-last-hides-alerts',
    'manager-revocation-and-recreated-team-cannot-recover-earlier-alerts',
  ];
  assert.deepEqual(run.steps.map(row=>row.id).sort(),expected.sort());
  assert(run.steps.every(row=>row.status==='passed'));
  assert.equal(Object.keys(run.sourceFiles).length,14);
  return run;
}
export function validateRetainedTeamAlerts(root,source=teamAlertEvidence) {
  const base=dirname(resolve(root,source)), run=validateTeamAlertRun(JSON.parse(readFileSync(resolve(root,source))));
  assertRetainedSourceFiles(root,run.sourceFiles);
  const hashes=JSON.parse(readFileSync(resolve(base,'artifact-sha256.json')));
  for(const required of ['services.json','README.md','earlier-failures.json','services-failure.txt','services-third-failure.txt'])
    assert.match(hashes[required],/^[a-f0-9]{64}$/);
  for(const [name,expected]of Object.entries(hashes))
    assert.equal(createHash('sha256').update(readFileSync(resolve(base,name))).digest('hex'),expected,name);
  return run;
}
