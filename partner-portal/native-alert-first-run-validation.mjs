import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
export const nativeAlertFirstRunFolder='docs/release/evidence/native-alert-first-run-b85076e-2026-11-01/';
export function validateNativeAlertFirstRun(root,folder=nativeAlertFirstRunFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8'),json=file=>JSON.parse(read(file));
  assertEvidenceBundleChecksums(base);const report=json('review.json');
  assert.equal(report.scope,'failed-native-alert-hosts-and-candidate-compile-not-verified-replay');
  assert.equal(report.sourceCommit,'b85076e033da6d09b8fa297cba2124fb1a6a981b');assert.equal(report.runId,41345045637);
  assert.equal(report.testedAt.slice(0,10),'2026-11-01');assert(report.startedAt<=report.testedAt);
  assert.deepEqual(report.alertCases,{total:7,passed:5,failed:2,platformExecuted:false});
  for(const key of ['fullGatePassed','remoteCasePassed','remoteForegroundReturnVerified','nativeNotificationPosted',
    'nativeNotificationTapVerified','pushDeliveryVerified','physicalDevice','releaseAccepted','productionWrites'])assert.equal(report[key],false,key);
  assert.equal(report.realMessagingSdkCalls,0);assert.equal(report.permissionRestored,true);assert.equal(report.deviceRestorationVerified,true);
  assert.deepEqual(report.publishedCaptures,{});
  assert.deepEqual(report.archives.map(row=>[row.id,row.sha256]),[
    [13099136586,'c8793ddddb92d1a3ed1829e94fd0d87d614993277b981c7657eb6b18cbe46ac2'],
    [13099296946,'03816f74456e6b981fb6084e1360da07d34c8e816516246da9c239a52654d0c6']]);
  assert.match(read('alert-instrumentation.txt'),/Tests run: 7,\s+Failures: 2/);
  assert.match(read('alert-instrumentation.txt'),/V2ThemeToggleProvider is missing from the app root/);
  for(const method of ['narrowLargeTextRetryScreenFitsItsFrame','wideDarkUnavailableScreenFitsItsActualLandscapeFrame'])
    assert(read('alert-instrumentation.txt').includes('Error in '+method));
  assert.match(read('remote-instrumentation.txt'),/ActivityScenario.getState/);assert.match(read('remote-instrumentation.txt'),/Current stage = STARTED/);
  assert.deepEqual(json('alert-permission-restoration.json'),{scope:'disposable-local-app-notification-permission-only',
    originallyGranted:false,restored:true,completed:false});
  for(const file of ['alert-device-restoration.json','remote-device-restoration.json']){
    const receipt=json(file);assert.equal(receipt.restored,true);assert.equal(receipt.verified,true);
    for(const key of ['authorizationRemoved','componentRemoved','originalPolicyRestored'])assert.equal(receipt.restoration.installAdmin[key],true);
  }
  const checkpoint=json('remote-checkpoint.json');assert.equal(checkpoint.appBackgrounded,true);
  assert.equal(checkpoint.peerCompletionAcknowledged,true);assert.equal(checkpoint.serviceRunningImmediatelyAfterCompletion,false);
  const candidate=report.candidate;assert.equal(candidate.sourceUnchangedDuringBuild,true);assert.equal(candidate.unitTests,790);
  assert.equal(candidate.focusedUnitTests,20);assert.equal(candidate.nativeUiCasesCompiled,12);assert.equal(candidate.instrumentationExecuted,false);
  for(const value of [candidate.app,candidate.testApp]){assert.match(value.sha256,/^[a-f0-9]{64}$/);assert(value.bytes>0);}
  assertRetainedSourceFiles(root,report.originalSourceFiles);assertRetainedSourceFiles(root,candidate.sourceFiles);
  const source=file=>readFileSync(resolve(root,'docs/release/evidence/source-archive',candidate.sourceFiles[file]+'.txt'),'utf8');
  const ui='android/app/src/main/java/be/sportgreenmoove/app/ui/',tests='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  assert(source(tests+'TeamPushOpenFlowTest.kt').includes('V2ThemeToggleProvider(darkTheme = dark'));
  assert(source(tests+'TeamPushOpenFlowTest.kt').includes('rootSelectsMessagesForAnAlert'));
  assert(source(ui+'SportsGreenMooveApp.kt').includes('currentScreen = if (teamAlertRequest != null) AppScreen.Messages else screen'));
  assert(source(ui+'AppBottomBar.kt').includes('.selectable(selected = selected, role = Role.Tab'));
  const observer=source(tests+'ObservedActivityStage.kt');assert(observer.includes('runOnMainSync'));
  assert(observer.includes('ActivityLifecycleMonitorRegistry.getInstance().getLifecycleStageOf(activity)'));assert(!observer.includes('catch'));
  const remote=source(tests+'LocalRemoteRideStopFlowTest.kt');assert(!remote.includes('activity.state'));
  assert(remote.includes('observedActivityStage(trackedActivity) == Stage.STOPPED'));assert(remote.includes('Stage.RESUMED'));
  const parser=new XMLParser({ignoreAttributes:false});
  for(const [name,count]of [['services.TeamPushAlertTest',13],['ui.TeamPushOpenStateTest',7]]){
    const suite=parser.parse(read('TEST-be.sportgreenmoove.app.'+name+'.xml')).testsuite;assert.equal(Number(suite['@_tests']),count);
    for(const key of ['failures','errors','skipped'])assert.equal(Number(suite['@_'+key]),0);
  }
  const main=json('main-review.json');
  assert.equal(main.sourceCommit,report.sourceCommit);assert.equal(main.runId,report.runId);
  assert.equal(main.jobId,124962966296);assert.equal(main.fullGatePassed,false);assert.equal(main.releaseAccepted,false);
  assert.equal(main.archive.id,13099119008);
  assert.equal(main.archive.sha256,'2f832d1a6676b4c349362494b59c4a6011d28ffdbd7ff425099a36b97cd83dd9');
  assert.deepEqual(main.ordinary,{total:300,passed:243,skipped:55,failed:2});
  assert.deepEqual(main.guardian,{total:1,passed:0,failed:1,firstAuthScreenReached:false,rootCauseVerified:false});
  assert.deepEqual(main.cleanupCopy,{completed:false,remoteDirectoryMissing:true,transportFailureProven:false});
  assert.deepEqual(main.publishedCaptures,{});
  const ordinary=parser.parse(read('main-ordinary.xml')).testsuite;
  assert.equal(Number(ordinary['@_tests']),300);assert.equal(Number(ordinary['@_skipped']),55);
  const failed=ordinary.testcase.filter(row=>row.failure);assert.equal(failed.length,2);
  assert.deepEqual(failed.map(row=>row['@_name']),main.failedOrdinaryCases);
  assert(failed.every(row=>row['@_classname']==='be.sportgreenmoove.app.ui.TeamPushOpenFlowTest'));
  assert.match(read('main-guardian-instrumentation.txt'),/login\(LocalGuardianVerificationFlowTest.kt:87\)/);
  const copy=json('main-copy-failure-cleanup.json');assert.equal(copy.status,1);assert.equal(copy.completed,false);
  assert.match(copy.stderr,/failed to stat remote object .*No such file or directory/);
  assert(read('candidate-build.txt').includes('BUILD SUCCESSFUL'));return report;
}
