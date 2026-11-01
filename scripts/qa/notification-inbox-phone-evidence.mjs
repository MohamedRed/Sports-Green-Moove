import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {notificationPhonePhases,verifyNotificationPhoneCheckpoint} from './notification-inbox-phone-checkpoints.mjs';

export const notificationInboxEvidence='docs/release/evidence/notification-inbox-phone-2026-11-01/run.json';
export function validateNotificationInboxPhone(root,source=notificationInboxEvidence) {
  const base=dirname(resolve(root,source)),json=file=>JSON.parse(readFileSync(resolve(base,file)));
  const run=json('run.json');assert.equal(run.scope,'physical-android-in-app-team-alerts-not-closed-app-push');
  assert.equal(run.testedAt.slice(0,10),'2026-11-01');assert.equal(run.androidApi,35);
  assert.deepEqual(run.requestedCaptureDimensions,{width:198,height:443});
  assert.deepEqual(run.actualCaptureDimensions,{width:198,height:442});
  for(const key of ['physicalDevice','inAppArrivalObserved','confirmedReadObserved','revocationObserved',
    'renewalHidesOldAlertsObserved','backgroundReturnObserved','protectedTaskPreviewObserved'])assert.equal(run[key],true,key);
  for(const key of ['phonePeerUsed','managerUiExecuted','installedApkIndependentlyHashed','wholeHeadAttested',
    'pushDeliveryVerified','tapNavigationVerified','iosExecuted','physicalGpsVerified','productionWrites','realPayments',
    'videoRecorded','nativeExports','firstPreviewAccepted','releaseEvidenceAccepted'])assert.equal(run[key],false,key);
  assert.equal(run.mapRequests,0);assertRetainedSourceFiles(root,run.sourceFiles);
  for(const label of ['first','verified']) {
    const report=json(label+'/records/results.json'),build=json(label+'/build.json'),disposal=json(label+'/disposal.json');
    assert.equal(report.completed,true);assert.equal(report.failed,false);
    assert.equal(report.runId,run.reports[label].runId);assert.match(report.runId,/^[a-f0-9]{32}$/);
    assert.equal(report.observedAt,run.reports[label].testedAt);
    assert.equal(report.checkpoints.length,9);assert.equal(report.adminClientClosed,true);assert.equal(report.firestoreClientTerminated,true);
    assert.deepEqual(report.actions,['publish','replay','revoke','renew','publish-new','revoke-background']);
    assert.equal(report.phoneUiProvenByObserver,false);assert.equal(report.pushDeliveryVerified,false);
    const baseline=json(label+'/records/baseline.json');
    for(const phase of notificationPhonePhases) {
      const point=json(label+'/records/'+phase+'.json');assert.equal(point.runId,report.runId);
      assert.deepEqual(verifyNotificationPhoneCheckpoint(phase,baseline,point.state,point.identity),point.check);
    }
    assert.equal(build.apk.sha256,run.reports[label].apkHash);assert.equal(build.apk.package,'be.sportgreenmoove.app.local');
    assert.equal(build.emulatorHost,'localhost');assert.equal(build.projectId,'demo-sgm-local-qa');
    assert.equal(build.focusedUnitTests,12);assert.equal(build.componentTestsCompiled,true);assert.equal(build.componentTestsExecuted,false);
    assert.equal(build.installedApkIndependentlyHashed,false);assert.equal(build.pushDeliveryVerified,false);
    assertRetainedSourceFiles(root,build.sourceFiles);assertRetainedSourceFiles(root,report.sourceFiles);
    let tests=0;for(const [file,hash]of Object.entries(build.junitFiles)) {
      const bytes=readFileSync(resolve(base,label,file));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
      const suite=new XMLParser({ignoreAttributes:false}).parse(bytes).testsuite;
      assert.equal(Number(suite['@_failures']),0);assert.equal(Number(suite['@_errors']),0);assert.equal(Number(suite['@_skipped']),0);
      tests+=Number(suite['@_tests']);
    }
    assert.equal(tests,12);
    const captures=json(label+'/capture-stages.json');assert.equal(captures.length,11);
    assert.equal(new Set(captures.map(row=>row.stage)).size,11);
    for(const phase of notificationPhonePhases)assert(captures.some(row=>row.stage===(phase==='ready'?'initial':phase)));
    for(const row of captures) {
      assert.equal(row.source,'observed-physical-phone-session-crop-not-native-export');
      assert.deepEqual(row.crop,{left:460,top:107,width:198,height:443});
      const png=readFileSync(resolve(base,label,row.stage+'.png'));
      assert.equal(png.readUInt32BE(16),198);assert.equal(png.readUInt32BE(20),442);
    }
    for(const key of ['ownedProcessesAbsent','privateSessionRemoved','helperHandoffRemoved','phoneReleaseDashboardObserved',
      'providerUninstallReportedSuccess','clipboardCleared'])assert.equal(disposal[key],true,key);
    assert.equal(disposal.installedPackageAbsenceIndependentlyVerified,false);assert.equal(disposal.originalClipboardRestored,false);
    assert.equal(disposal.productionWrites,false);assert.equal(disposal.realAccountsModified,false);
    assert.deepEqual(disposal.endpoints,{host:'127.0.0.1',ports:[9099,8080,9000,5001],closed:true});
    assert.equal(disposal.runtimeDirectoryAbsenceIndependentlyBound,label==='verified');
    if(label==='verified')assert.equal(disposal.runtimeDirectoryRemoved,true);
    const ui=readFileSync(resolve(base,label,'device-release-ax.txt'),'utf8');
    assert(ui.includes('App Live Dashboard')&&ui.includes('Succesfully uninstalled')&&!ui.includes('Description: Stop Session'));
  }
  const services=json('services.json');assert.equal(services.completed,true);assert.equal(services.steps.length,7);
  assert(services.steps.every(row=>row.status==='passed'));assert.equal(new Set(services.steps.map(row=>row.id)).size,7);
  for(const key of ['adminClientClosed','firestoreClientTerminated','isolatedEnvironmentDestroyed'])assert.equal(services[key],true);
  for(const key of ['physicalDevice','nativeUiExecuted','pushDeliveryVerified','productionWrites','realPayments'])assert.equal(services[key],false);
  assert.equal(services.isolation.protectedBaselinePreserved,true);assertRetainedSourceFiles(root,services.sourceFiles);
  const preview=json('preview-samples.json');assert(preview.first.stdDev>15&&preview.first.min<100);
  assert.equal(preview.verified.stdDev,0);assert.equal(preview.verified.mean,250);
  for(const [label,file]of [['first','recents-stale-preview.png'],['verified','recents-protected-preview.png']]) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(base,label,file))).digest('hex'),preview[label].sha256);
    assert.deepEqual(preview[label].region,{left:38,top:90,width:125,height:120});
  }
  assert.deepEqual(run.publishedCaptures,Object.fromEntries(['arrived','read','revoked','returned']
    .map(phase=>['team-alert-phone-'+phase,'verified/'+phase+'.png'])));
  const hashes=json('artifact-sha256.json');for(const required of ['run.json','README.md','services.json','preview-samples.json'])
    assert.match(hashes[required],/^[a-f0-9]{64}$/);
  for(const [file,expected]of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(resolve(base,file))).digest('hex'),expected,file);
  return run;
}
