import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const pushCleanupFolder='docs/release/evidence/team-push-invalidation-2026-11-01/';
export const returnPassFolder='docs/release/evidence/foreground-return-pass-93d9138-2026-11-01/';
const open=(root,folder)=>{
  const base=resolve(root,folder);assertEvidenceBundleChecksums(base);
  const read=file=>readFileSync(resolve(base,file),'utf8');return {read,json:file=>JSON.parse(read(file))};
};
export function validatePushCleanup(root,folder=pushCleanupFolder){
  const {read,json}=open(root,folder),review=json('review.json'),services=json('services.json');
  assert.equal(review.scope,'isolated-invalid-token-cleanup-not-provider-or-phone-proof');
  assert.equal(review.serviceCases,22);assert.equal(review.invalidationCases,8);assert.equal(review.unitTests,623);
  assert.equal(review.focusedUnitTests,12);assert.equal(review.defectReproduced,true);assert.equal(review.intermediateSourceDriftRejected,true);
  assert.equal(services.scope,'isolated-durable-dispatch-with-injected-transport-not-provider-or-phone-delivery');
  assert.equal(services.projectId,'demo-sgm-local-qa');assert.equal(services.completed,true);assert.equal(services.steps.length,22);
  assert.equal(new Set(services.steps.map(row=>row.id)).size,22);for(const step of services.steps)assert.equal(step.status,'passed');
  for(const id of ['invalid-token-retires-current-binding-blocks-frozen-alerts-and-requires-a-new-revision',
    'late-invalid-token-preserves-token-refresh','late-invalid-token-preserves-account-switch','late-invalid-token-preserves-signout',
    'late-invalid-token-cannot-delete-a-token-rebound-to-another-installation',
    'configuration-temporary-and-unknown-errors-never-retire-device-registration',
    'concurrent-invalid-results-retire-the-same-binding-idempotently',
    'late-invalid-result-with-an-expired-lease-cannot-retire-the-winning-registration'])
    assert(services.steps.some(row=>row.id===id),id);
  assert.equal(services.isolation.protectedBaselinePreserved,true);
  for(const key of ['adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])assert.equal(services[key],true,key);
  assert.deepEqual(services.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  for(const key of ['productionWrites','physicalDevice','pushDeliveryVerified']){
    assert.equal(review[key],false,key);assert.equal(services[key],false,key);
  }
  for(const key of ['productionDeployed','releaseAccepted'])assert.equal(review[key],false,key);
  assert.equal(review.providerRequests,0);assert.equal(services.providerRequests,0);assert.deepEqual(review.publishedCaptures,{});
  assert.match(read('first-failure.txt'),/true !== false/);assert.match(read('source-drift-rejected.txt'),/strictly deep-equal/);
  assertRetainedSourceFiles(root,services.sourceFiles);assertRetainedSourceFiles(root,review.initialSourceFiles);
  for(const [file,count]of [['team-push-invalidation-units.xml',12],['team-push-dispatch-units.xml',22]]){
    const suite=new XMLParser({ignoreAttributes:false}).parse(read(file)).testsuite;
    assert.equal(Number(suite['@_tests']),count);assert.equal(Number(suite['@_failures']),0);
  }
  return review;
}
export function validateReturnPass(root,folder=returnPassFolder){
  const {read,json}=open(root,folder),review=json('review.json'),run=json('remote-ride-stop-results.json');
  assert.equal(review.scope,'isolated-native-foreground-return-pass-not-physical-or-full-gate');
  assert.equal(review.sourceCommit,'93d9138f71f9db4c315f6733448666d19e2e638b');assert.equal(review.runId,41351599563);
  assert.equal(review.jobId,124982776166);assert.equal(review.jobConclusion,'success');
  assert.deepEqual(review.archive,{id:13101791762,sha256:'adccffd0c00ce84d2c16a2240691aa74ca40d766b4d30f00bfb6390ff91aa53d'});
  assert.equal(review.frameworkCases,2);assert.equal(review.connectedRideCases,1);assert.equal(review.correctedRemoteTrialPassed,true);
  for(const key of ['wholeGatePassed','physicalDevice','providerTrackingVerified','releaseAccepted','productionWrites'])assert.equal(review[key],false,key);
  assert.deepEqual(review.publishedCaptures,{});assert.match(read('ForegroundReturnIntentTest-instrumentation.txt'),/OK \(2 tests\)/);
  assert.match(read('LocalRemoteRideStopFlowTest-instrumentation.txt'),/OK \(1 test\)/);
  for(const key of ['backgroundStopBeforeResume','driverStillSignedInAtStop','peerCompletionAcknowledged','nativeUiExecuted',
    'adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed','localPackagesRemoved'])assert.equal(run[key],true,key);
  for(const key of ['physicalDevice','providerTrackingVerified','physicalBackgroundGpsVerified','productionWrites','safetyAuditAccepted',
    'storeReviewAccepted'])assert.equal(run[key],false,key);
  assert.equal(run.completion.claimsUnchanged,true);assert.equal(run.isolation.baselineRecordsPreserved,true);
  assert.equal(run.emulatorEndpoints.closed,true);assertRetainedSourceFiles(root,run.sourceFiles);
  const checkpoint=json('local-remote-ride-stop-checkpoint.json');assert.equal(checkpoint.appBackgrounded,true);
  assert.equal(checkpoint.serviceRunningImmediatelyAfterCompletion,false);
  assert.equal(json('adb-pull-remote-ride-stop.json').completed,true);
  assert.equal(json('remote-ride-stop-suite-status.json').status,0);
  const restored=json('disposable-device-restore.json');assert.equal(restored.restored,true);assert.equal(restored.verified,true);
  assert.equal(restored.restoration.installAdmin.authorizationRemoved,true);
  assert.equal(restored.restoration.installAdmin.originalPolicyRestored,true);
  return review;
}
