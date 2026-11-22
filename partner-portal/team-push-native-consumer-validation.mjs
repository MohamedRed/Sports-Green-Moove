import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {nativeTeamAlertSources,nativeTeamAlertCases} from '../scripts/qa/native-team-alert-sources.mjs';
import {nativeTeamPushSuiteName} from '../scripts/qa/native-team-push-sources.mjs';
export const nativeTeamAlertFolder='docs/release/evidence/native-team-push-alert-consumer-2026-11-01/';
export function validateNativeTeamAlertConsumer(root,folder=nativeTeamAlertFolder){
  const base=resolve(root,folder),read=file=>readFileSync(resolve(base,file),'utf8');assertEvidenceBundleChecksums(base);
  const report=JSON.parse(read('review.json'));
  assert.equal(report.scope,'native-alert-consumer-jvm-and-isolated-build-only');assert.equal(report.testedAt.slice(0,10),'2026-11-01');
  assert(report.startedAt<=report.testedAt);assert.equal(report.unitTests,790);assert.equal(report.focusedUnitTests,20);
  assert.deepEqual(report.focusedSuites,nativeTeamAlertCases);
  for(const key of ['sourceUnchangedDuringBuild','appCompiled','instrumentationCompiled','nativeLifecycleImplemented',
    'isolatedBuild','nativeConsumerImplemented','workerCompiled','genericPayloadOnly','notificationPermissionTestPrepared'])assert.equal(report[key],true,key);
  for(const key of ['instrumentationExecuted','realSdkCallsExecuted','runtimeCallbacksExecuted','authenticatedSignoutRemovalVerified',
    'realPhoneTokenRegistered','dispatcherImplemented','pushDeliveryVerified','tapNavigationVerified','automaticRetry',
    'physicalDevice','productionWrites','releaseAccepted','nativeUiCasesExecuted','workerExecuted','nativeNotificationPosted',
    'nativeNotificationTapVerified'])assert.equal(report[key],false,key);
  assert.equal(report.providerSends,0);assert.equal(report.mapRequests,0);assert.equal(report.nativeUiCasesCompiled,11);
  assert.equal(report.messagingSdkVersion,'25.0.2');
  assert.deepEqual(Object.keys(report.sourceFiles).sort(),[...nativeTeamAlertSources].sort());assertRetainedSourceFiles(root,report.sourceFiles);
  const parser=new XMLParser({ignoreAttributes:false});const files=readdirSync(resolve(base,'junit'));
  assert.equal(files.length,report.unitSuites);
  const suites=files.map(file=>parser.parse(read('junit/'+file)).testsuite);
  for(const suite of suites){
    for(const key of ['failures','errors','skipped'])assert.equal(Number(suite['@_'+key]),0);
    assert.equal(suite['@_hostname'],'local-test-host');const cases=[suite.testcase].flat();assert.equal(cases.length,Number(suite['@_tests']));
    for(const row of cases)assert(!('failure'in row||'error'in row||'skipped'in row));
  }
  assert.equal(suites.reduce((sum,row)=>sum+Number(row['@_tests']),0),790);
  for(const [name,count]of Object.entries(nativeTeamAlertCases))
    assert.equal(Number(suites.find(row=>row['@_name']===nativeTeamPushSuiteName(name))?.['@_tests']),count);
  assert.deepEqual(JSON.parse(read('registration-manifest.json')),{applicationClass:'be.sportgreenmoove.app.SgmApplication',
    autoInit:false,delegation:false,service:{name:'be.sportgreenmoove.app.services.TeamPushMessagingService',enabled:false,exported:false}});
  for(const apk of [report.apk,report.testApk]){assert.match(apk.sha256,/^[a-f0-9]{64}$/);assert(apk.bytes>0);}
  const log=read('build-success.txt');assert(log.includes('BUILD SUCCESSFUL'));
  for(const task of ['testDebugUnitTest','assembleDebug','assembleDebugAndroidTest','dependencyInsight'])assert(log.includes(':app:'+task));
  return report;
}
