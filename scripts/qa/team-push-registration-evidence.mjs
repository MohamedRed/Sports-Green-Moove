import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
export const teamPushRegistrationOriginalFolder='docs/release/evidence/team-push-registration-2026-11-01/';
export const teamPushRegistrationFolder='docs/release/evidence/team-push-registration-recheck-2026-11-01/';
const checkpointIds=['authentication-and-unknown-owner-field-are-rejected',
  'concurrent-identical-registration-creates-one-private-binding-without-returning-token-or-proof',
  'another-account-cannot-take-a-known-installation-without-its-proof',
  'token-rotation-removes-old-index-and-rejects-reordered-or-conflicting-updates',
  'concurrent-out-of-order-revisions-converge-on-the-newest-token-only','a-token-cannot-be-copied-into-another-installation',
  'account-switch-transfers-one-binding-and-old-account-cannot-replay-or-remove-it',
  'signout-removal-leaves-a-revision-tombstone-and-delayed-registration-cannot-revive-it',
  'newer-signin-is-explicit-and-removal-before-first-token-also-prevents-delayed-activation',
  'mixed-child-claims-linked-child-login-child-profile-and-disabled-account-cannot-register',
  'private-registration-and-token-index-cannot-be-read-or-listed-by-client-accounts','removing-one-device-does-not-disable-other-devices',
  'active-device-limit-rejects-without-an-extra-token-or-binding','missing-token-index-fails-closed-without-rewriting-the-registration',
  'corrupt-registration-fingerprint-cannot-be-promoted-by-a-new-revision','all-original-records-account-claims-and-disabled-states-remain-unchanged'];

function validateRegistrationBundle(root,folder,ids,unitCount){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const review=json('review.json'),report=json('services.json');
  assert.equal(review.scope,'server-registration-prerequisite-not-closed-app-delivery');assert.equal(review.testedAt.slice(0,10),'2026-11-01');
  assert.equal(report.scope,'isolated-server-device-registration-not-native-or-push-delivery');
  assert.equal(report.projectId,'demo-sgm-local-qa');assert.equal(report.runId,review.runId);assert.equal(report.testedAt,review.testedAt);
  assert.equal(report.completed,true);assert.deepEqual(report.steps,ids.map(id=>({id,status:'passed'})));
  assert.equal(review.checkpoints,ids.length);assert.equal(review.unitTests,unitCount);assert.equal(review.registrationUnitTests,15);assert.equal(review.rulesTests,20);
  for(const key of ['adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])assert.equal(report[key],true,key);
  assert.equal(report.isolation.protectedBaselinePreserved,true);
  assert.deepEqual(report.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  for(const key of ['nativeUiExecuted','physicalDevice','pushDeliveryVerified','realPhoneTokenRegistered','productionWrites','realPayments'])assert.equal(report[key],false,key);
  for(const key of ['mapRequests','providerRequests'])assert.equal(report[key],0,key);
  for(const key of ['dispatcherImplemented','nativeLifecycleImplemented','realPhoneTokenRegistered','pushDeliveryVerified','physicalDevice',
    'wholeHeadAttested','productionWrites','releaseAccepted','failedFixtureTrialAccepted','failedFixtureTrialSourceAttested'])assert.equal(review[key],false,key);
  assert.equal(review.providerRequests,0);assert.equal(review.failedFixtureTrialRetained,true);assert.deepEqual(review.publishedCaptures,{});
  assert.match(read('failed-fixture-trial.txt'),/1 !== 0/);assert.match(read('failed-fixture-trial.txt'),/local-team-push-registration-suite\.mjs:63/);
  assert.doesNotMatch(read('failed-fixture-trial.txt'),/Bearer |synthetic_token_|idToken|refreshToken|password|installationSecret/i);
  assertRetainedSourceFiles(root,report.sourceFiles);assertRetainedSourceFiles(root,review.sourceFiles);
  const parser=new XMLParser({ignoreAttributes:false});
  for(const [file,total]of [['functions.xml',unitCount],['rules.xml',20]]){
    const xml=parser.parse(read(file)).testsuites;assert.equal(Number(xml['@_tests']),total);
    for(const key of ['failures','errors'])assert.equal(Number(xml['@_'+key]),0);
    const suites=[xml.testsuite].flat();assert.equal(suites.reduce((sum,row)=>sum+Number(row['@_skipped']??0),0),0);
    if(file==='functions.xml'){
      const suite=suites.find(row=>row['@_name']==='src/__tests__/team-push-registration.test.ts');assert(suite);
      assert.equal(Number(suite['@_tests']),15);
    }
  }return review;
}

export function validateTeamPushRegistration(root,folder=teamPushRegistrationFolder){
  validateRegistrationBundle(root,teamPushRegistrationOriginalFolder,checkpointIds,565);
  const ids=[...checkpointIds];ids.splice(10,0,'current-child-claims-deny-a-still-valid-earlier-adult-login',
    'stale-adult-login-cannot-list-read-send-or-acknowledge-after-current-child-claims',
    'disabled-account-with-valid-earlier-login-cannot-use-team-history-or-write-messages');
  const review=validateRegistrationBundle(root,folder,ids,571);
  assert.equal(review.currentClaimsRechecked,true);assert.equal(review.staleClaimTrialRetained,true);assert.equal(review.staleClaimTrialAccepted,false);
  const negative=readFileSync(resolve(root,folder,'stale-claims-trial.txt'),'utf8');
  assert.match(negative,/Missing expected rejection: registerTeamPushDevice must reject with PERMISSION_DENIED/);
  assert.doesNotMatch(negative,/Bearer |synthetic_token_|idToken|refreshToken|password|installationSecret/i);
  return review;
}
