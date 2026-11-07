import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const teamPushDispatchFolder='docs/release/evidence/team-push-dispatch-2026-11-01/';
export function validateTeamPushDispatch(root,folder=teamPushDispatchFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const report=json('review.json'),run=json('services.json');
  assert.equal(report.scope,'isolated-dispatch-and-native-consumer-components-not-delivery-or-release');
  assert.equal(report.dispatcherImplemented,true);assert.equal(report.serviceCases,14);
  assert.equal(report.backendUnitTests,611);assert.equal(report.focusedUnitTests,22);
  for(const key of ['productionDeployed','pushDeliveryVerified','nativeNotificationTapVerified','physicalDevice','releaseAccepted'])assert.equal(report[key],false,key);
  assert.equal(report.providerRequests,0);assert.deepEqual(report.publishedCaptures,{});
  assert.equal(run.projectId,'demo-sgm-local-qa');assert.equal(run.completed,true);
  assert.equal(run.testedAt.slice(0,10),'2026-11-01');assert.equal(run.isolation.protectedBaselinePreserved,true);
  for(const key of ['adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])assert.equal(run[key],true,key);
  assert.deepEqual(run.emulatorEndpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  for(const key of ['nativeUiExecuted','physicalDevice','pushDeliveryVerified','productionWrites'])assert.equal(run[key],false,key);
  assert.equal(run.providerRequests,0);assert.equal(run.simulatedTransportCalls,6);
  assert.equal(run.steps.length,14);assert.equal(new Set(run.steps.map(row=>row.id)).size,14);
  assert(run.steps.every(row=>row.status==='passed'));
  for(const name of ['current-account-switch','signout-tombstone','guardian-withdrawal','unknown-send-outcomes',
    'live-lease','expired-lease','recipient-and-delivery-records','corrupt-reverse-token-owner'])
    assert(run.steps.some(row=>row.id.startsWith(name)),name);
  assertRetainedSourceFiles(root,run.sourceFiles);assertRetainedSourceFiles(root,report.initialFixtureSourceFiles);
  assert.match(read('initial-expiry-fixture-failure.txt'),/local-team-push-dispatch-suite.mjs:98:39/);
  const unit=new XMLParser({ignoreAttributes:false}).parse(read('dispatch-unit.xml')).testsuite;
  assert.equal(Number(unit['@_tests']),22);assert.equal(Number(unit['@_failures']),0);
  const native=json('native-results.json');assert.equal(native.componentCaseCount,8);assert.equal(native.platformCaseCount,4);
  for(const key of ['nativeUiExecuted','nativeNotificationPosted','workerInvokedWithInjectedResolver','notificationPermissionRestored'])assert.equal(native[key],true,key);
  for(const key of ['physicalDevice','pushDeliveryVerified','nativeNotificationTapVerified','productionWrites'])assert.equal(native[key],false,key);
  assert.equal(native.realMessagingSdkCalls,0);assertRetainedSourceFiles(root,native.sourceFiles);
  assert.match(read('native-route.txt'),/OK \(8 tests\)/);assert.match(read('native-platform.txt'),/OK \(4 tests\)/);
  assert.equal(json('native-copy.json').completed,true);
  assert.deepEqual(json('native-permission.json'),{scope:'disposable-local-app-notification-permission-only',originallyGranted:false,restored:true,completed:true});
  for(const name of ['native-restore.json','remote-restore.json']){
    const value=json(name);assert.equal(value.restored,true);assert.equal(value.verified,true);
  }
  assert.equal(report.native.sourceCommit,'11c423b6cd49e652e7d228130eddcad2dd7f03fd');assert.equal(report.native.runId,41347838315);
  assert.equal(report.native.remoteTrialPassed,false);assert.equal(report.native.remoteFinalMarkerWritten,false);
  assert.equal(report.native.wholeGatePassed,false);assert.equal(report.native.nativeNotificationPosted,true);
  assert.equal(report.native.injectedResolver,true);assert.equal(report.native.realMessagingSdkCalls,0);
  assert.deepEqual(report.native.archives,[
    {id:13100227677,sha256:'0a470628f133b5052199a9fe8b5a770f0ca45e10ca529097b62ee2aa735a1ba6'},
    {id:13100043476,sha256:'f78f9b4ef5c3b422cff83d7fd4f02e211448ba4711e980314d087c4c9cd20079'}]);
  assert.match(read('remote-transcript.txt'),/ActivityScenario.close/);assert.match(read('remote-transcript.txt'),/Tests run: 1,\s+Failures: 1/);
  const checkpoint=json('remote-checkpoint.json');assert.equal(checkpoint.appBackgrounded,true);assert.equal(checkpoint.peerCompletionAcknowledged,true);
  assert.equal(checkpoint.serviceRunningImmediatelyAfterCompletion,false);
  assert.equal(report.teardownCandidate.sourceUnchangedDuringBuild,true);assert.equal(report.teardownCandidate.instrumentationExecuted,false);
  assertRetainedSourceFiles(root,report.teardownCandidate.sourceFiles);assert.match(read('teardown-build.txt'),/BUILD SUCCESSFUL/);
  return report;
}
