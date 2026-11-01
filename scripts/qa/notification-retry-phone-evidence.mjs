import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {notificationRetryPhases,verifyNotificationRetryCheckpoint} from './notification-retry-phone-checkpoints.mjs';

export const notificationRetryPhoneFolder='docs/release/evidence/notification-retry-phone-2026-11-01/';
export function validateNotificationRetryPhone(root,folder=notificationRetryPhoneFolder){
  const base=resolve(root,folder),json=file=>JSON.parse(readFileSync(resolve(base,file))),run=json('run.json');
  assertEvidenceBundleChecksums(base);assert.equal(run.scope,'physical-android-notification-only-retry-not-closed-app-push');
  assert.equal(run.testedAt.slice(0,10),'2026-11-01');assert.equal(run.reportedDevice,'Google Pixel 9 Pro');assert.equal(run.reportedAndroidVersion,'15');
  for(const key of ['physicalDevice','failedRetryObserved','recoveredReadStateObserved','subsequentAutomaticArrivalObserved','componentTestsCompiled'])assert.equal(run[key],true,key);
  for(const key of ['componentTestsExecutedLocally','reviewPaginationPhysicallyVerified','installedApkIndependentlyHashed','wholeHeadAttested',
    'phonePeerUsed','managerUiExecuted','pushDeliveryVerified','physicalGpsVerified','realRadioLossVerified','iosExecuted','productionWrites',
    'realPayments','videoRecorded','nativeExports','earlierCaptureFailureOverridden','releaseEvidenceAccepted'])assert.equal(run[key],false,key);
  assert.equal(run.mapRequests,0);assert.equal(run.unrelatedListReloadsObserved,0);
  assert.equal(run.protectedRecords,198);assert.equal(run.checkpoints,7);assert.equal(run.focusedUnitTests,14);assert.equal(run.fullUnitTests,695);
  assertRetainedSourceFiles(root,run.sourceFiles);
  const report=json('records/results.json');assert.equal(report.completed,true);assert.equal(report.failed,false);
  assert.equal(report.runId,run.runId);assert.equal(report.observedAt,run.testedAt);assert.equal(report.checkpoints.length,7);
  assert.equal(report.phoneUiVerified,false);assert.equal(report.pushDeliveryVerified,false);
  assert.equal(report.adminClientClosed,true);assert.equal(report.firestoreClientTerminated,true);assertRetainedSourceFiles(root,report.sourceFiles);
  assert.deepEqual(report.actions,['publish','corrupt','restore','publish-next']);
  const baseline=json('records/baseline.json'),prior={};
  for(const phase of notificationRetryPhases){
    const point=json('records/'+phase+'.json');assert.equal(point.runId,run.runId);
    assert.deepEqual(verifyNotificationRetryCheckpoint(phase,baseline,point.state,point.identity,prior),point.check);
    assert.equal(point.check.protectedRecords,198);prior[phase]=point.state;
  }
  const build=json('build.json');assert.equal(build.apk.package,'be.sportgreenmoove.app.local');assert.match(build.apk.sha256,/^[a-f0-9]{64}$/);
  assert.equal(build.projectId,'demo-sgm-local-qa');assert.equal(build.emulatorHost,'localhost');assert.equal(build.unitTests,695);
  assert.equal(build.focusedUnitTests,14);assert.equal(build.componentTestsExecuted,false);assertRetainedSourceFiles(root,build.sourceFiles);
  let tests=0;for(const [file,hash]of Object.entries(build.junitFiles)){
    const bytes=readFileSync(resolve(base,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
    const xml=new XMLParser({ignoreAttributes:false}).parse(bytes).testsuite;
    for(const key of ['failures','errors','skipped'])assert.equal(Number(xml['@_'+key]),0);tests+=Number(xml['@_tests']);
  }assert.equal(tests,14);
  const captures=json('capture-stages.json');assert.deepEqual(captures.map(row=>row.stage),['initial','arrived','read','error','retry-failed','recovered','next-arrived']);
  for(const row of captures){
    assert.equal(row.source,'observed-physical-phone-session-crop-not-native-export');
    assert.deepEqual(row.requestedCrop,{left:460,top:107,width:198,height:443});assert.deepEqual(row.actualDimensions,{width:198,height:442});
    const png=readFileSync(resolve(base,row.stage+'.png'));assert.equal(png.readUInt32BE(16),198);assert.equal(png.readUInt32BE(20),442);
  }
  const disposal=json('disposal.json');
  for(const key of ['ownedProcessesAbsent','privateSessionRemoved','helperHandoffRemoved','phoneReleaseDashboardObserved',
    'providerUninstallReportedSuccess','runtimeDirectoryAbsenceIndependentlyBound','runtimeDirectoryRemoved','originalClipboardRestored'])assert.equal(disposal[key],true,key);
  for(const key of ['installedPackageAbsenceIndependentlyVerified','clipboardCleared','deviceClipboardStateIndependentlyVerified','realAccountsModified','productionWrites'])assert.equal(disposal[key],false,key);
  assert.deepEqual(disposal.endpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
  assert.deepEqual(json('clipboard-state.json'),{scope:'browser-api-clipboard-restoration-not-device-proof',hostOriginalClipboardRestored:true,
    deviceClipboardStateIndependentlyVerified:false,credentialEntryScreenshotsRetained:false});
  const ui=readFileSync(resolve(base,'device-release-ax.txt'),'utf8');assert(ui.includes('App Live Dashboard')&&ui.includes('Succesfully uninstalled')&&!ui.includes('Description: Stop Session'));
  assert.deepEqual(run.publishedCaptures,{'team-alert-retry-error':'error.png','team-alert-retry-recovered':'recovered.png','team-alert-retry-next':'next-arrived.png'});
  return run;
}
