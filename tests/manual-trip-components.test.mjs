import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {packagesForCase, ordinaryPackages, focusedCases} from '../scripts/qa/android-case-apks.mjs';
import {isApprovedDeviceCase, preparePinnedApks} from '../scripts/qa/preinstalled-disposable-apks.mjs';
import {restoreContinuousDevice} from '../scripts/qa/continuous-disposable-device.mjs';
import {continuousFixture, approvalKeys, assertNoGuardedInstallOrUnlock} from './fixtures/continuous-disposable-device.mjs';
import {resetDisposableTestApps} from '../scripts/qa/reset-disposable-local-apps.mjs';
import {runManualTripComponents} from '../scripts/qa/run-manual-trip-components.mjs';

const fixture = t => {
  const f = continuousFixture(t, {case:'trip-change-components'});
  f.env.SGM_COMPONENT_UI_APPROVAL = 'trip-change-capture-only'; return f;
};
test('manual trip capture is separate from Linux-only full matrix and recurring focused jobs', () => {
  assert.equal(isApprovedDeviceCase({SGM_FOCUSED_UI_CASE:'full-matrix'}), false);
  assert.equal(isApprovedDeviceCase({SGM_FOCUSED_UI_CASE:'trip-change-components'}), false);
  assert.equal(focusedCases.includes('trip-change-components'), false);
  assert.deepEqual(Object.keys(packagesForCase('trip-change-components')), Object.keys(ordinaryPackages));
});
test('manual component setup pins only its two ordinary APKs and restores the complete policy', t => {
  const f = fixture(t), receipt = f.prepareAndSave();
  assert.equal(f.env.GITHUB_ACTIONS, undefined); assert.equal(f.env.RUNNER_OS, undefined);
  assert.deepEqual(Object.keys(receipt.apkHashes), Object.keys(ordinaryPackages));
  const proof = preparePinnedApks({android:f.android,serial:f.device.serial,env:f.env,device:f.device});
  assert.equal(proof.installationsRemainedBlocked, true); assertNoGuardedInstallOrUnlock(f.events);
  const restored = restoreContinuousDevice(f.device, receipt, f.execute, f.deps);
  assert.equal(restored.verified, true); assert.equal(f.state.owner, false); assert.equal(f.state.installed.size, 0);
});
for (const key of [...approvalKeys,'SGM_COMPONENT_UI_APPROVAL']) test('manual capture rejects missing ' + key + ' without writes', t => {
  const f = fixture(t); delete f.env[key]; assert.throws(f.prepare); assert.equal(f.events.length, 0);
});
test('wrong ordinary metadata stops manual setup before any device operation', t => {
  const f = fixture(t), path = resolve(f.android,'app/build/outputs/matrix-apks/ordinary-test/output-metadata.json');
  const metadata = JSON.parse(readFileSync(path)); metadata.applicationId = 'be.sportgreenmoove.app.local.test';
  writeFileSync(path,JSON.stringify(metadata)); assert.throws(f.prepare); assert.equal(f.events.length, 0);
});
test('real cleanup path removes exactly the ordinary test then app, rejecting extra packages',()=>{
  const names=['be.sportgreenmoove.app.test','be.sportgreenmoove.app'],installed=new Set(names),removed=[];
  const execute=(_adb,args)=>{
    if(args[2]==='wait-for-device') return '';
    if(args[2]==='get-state') return 'device';
    if(args.slice(2).join(' ')==='shell getprop ro.kernel.qemu') return '1';
    if(args[2]==='uninstall'){removed.push(args[3]);installed.delete(args[3]);return 'Success';}
    return [...installed].map(name=>'package:'+name).join('\n');
  };
  const original=process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;process.env.SGM_LOCAL_DISPOSABLE_EMULATOR='true';
  try{resetDisposableTestApps('adb','emulator-5554',names,execute);
    assert.throws(()=>resetDisposableTestApps('adb','emulator-5554',[...names,'foreign.app'],execute));}
  finally{if(original===undefined)delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR=original;}
  assert.deepEqual(removed,names);assert.equal(installed.size,0);
});
const transcript=(code=0)=>`INSTRUMENTATION_STATUS: sgm_installations_blocked=true
INSTRUMENTATION_STATUS_CODE: 0
INSTRUMENTATION_STATUS: class=be.sportgreenmoove.app.ui.TripChangeFlowTest
INSTRUMENTATION_STATUS: test=largeTextParentSeesBothVersionsAndAcceptsWithoutApplying
INSTRUMENTATION_STATUS: numtests=1
INSTRUMENTATION_STATUS: current=1
INSTRUMENTATION_STATUS_CODE: 1
INSTRUMENTATION_STATUS: class=be.sportgreenmoove.app.ui.TripChangeFlowTest
INSTRUMENTATION_STATUS: test=largeTextParentSeesBothVersionsAndAcceptsWithoutApplying
INSTRUMENTATION_STATUS: numtests=1
INSTRUMENTATION_STATUS: current=1
INSTRUMENTATION_STATUS_CODE: ${code}
${code===0||code===-4?'OK (1 test)':'FAILURES!!!'}
INSTRUMENTATION_CODE: -1
`;
test('manual runner uses one fixed test, consumes its receipt once, and cannot accept the full matrix',t=>{
  const f=fixture(t);f.prepareAndSave();let calls=0;
  const spawn=(_adb,args)=>{calls++;assert(args.includes('be.sportgreenmoove.app.ui.TripChangeFlowTest#largeTextParentSeesBothVersionsAndAcceptsWithoutApplying'));
    return {status:0,signal:null,stdout:transcript(),stderr:''};};
  const report=runManualTripComponents({env:f.env,root:f.directory,device:f.device,spawn});
  assert.equal(report.scope,'single-trip-change-screen-diagnostic-not-full-matrix-or-release-proof');
  assert.equal(report.passed,1);assert.equal(report.fullMatrixAccepted,false);assert.equal(report.physicalDeviceAccepted,false);
  assert.throws(()=>runManualTripComponents({env:f.env,root:f.directory,device:f.device,spawn}));assert.equal(calls,1);
});
for(const [name,stdout] of [['failure',transcript(-2)],['skip',transcript(-4)],['crash','INSTRUMENTATION_RESULT: shortMsg=Process crashed.']])
  test('manual runner preserves and rejects '+name+' without retry',t=>{
    const f=fixture(t);f.prepareAndSave();let calls=0;
    const spawn=(_adb,args)=>{if(args.includes('logcat'))return{status:0,signal:null,stdout:'',stderr:''};
      calls++;return{status:0,signal:null,stdout,stderr:''};};
    assert.throws(()=>runManualTripComponents({env:f.env,root:f.directory,device:f.device,spawn}));assert.equal(calls,1);
    assert.equal(readFileSync(resolve(f.directory,'component-instrumentation.txt'),'utf8'),stdout);
  });
test('startup diagnostic includes native crash tags and redacts access tokens',t=>{
  const f=fixture(t);f.prepareAndSave();let attempts=0;
  const spawn=(_adb,args)=>{
    if(args.includes('logcat')){assert.equal(args.at(-1),'brief');return{status:0,signal:null,stdout:'F DEBUG native trace Bearer private-diagnostic-token',stderr:''};}
    attempts++;return{status:0,signal:null,stdout:'INSTRUMENTATION_RESULT: shortMsg=Process crashed.',stderr:''};
  };
  assert.throws(()=>runManualTripComponents({env:f.env,root:f.directory,device:f.device,spawn}));assert.equal(attempts,1);
  const retained=readFileSync(resolve(f.directory,'component-crash.txt'),'utf8');
  assert(retained.includes('F DEBUG native trace'));assert(!retained.includes('private-diagnostic-token'));
});
test('startup diagnostic errors do not replace the primary failure or retry instrumentation',t=>{
  const f=fixture(t);f.prepareAndSave();t.mock.method(console,'warn',()=>{});let attempts=0;
  const spawn=(_adb,args)=>{if(args.includes('logcat'))throw Error('diagnostic unavailable');
    attempts++;return{status:0,signal:null,stdout:'INSTRUMENTATION_RESULT: shortMsg=Process crashed.',stderr:''};};
  assert.throws(()=>runManualTripComponents({env:f.env,root:f.directory,device:f.device,spawn}),/Instrumentation did not complete normally/);
  assert.equal(attempts,1);
});
