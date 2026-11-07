import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {installationGuardArguments,disposableTestRunner} from './install-disposable-test-apks.mjs';
import {assertContinuousDevice} from './preinstalled-disposable-apks.mjs';
import {assertLocalApkIdentity} from './local-apk-identity.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';
import {collectLocalUiEvidence} from './collect-local-ui-evidence.mjs';
import {nativeTeamAlertSources} from './native-team-alert-sources.mjs';
import {withDisposableNotificationPermission} from './disposable-notification-permission.mjs';

const [receiptPath,directory]=process.argv.slice(2),root=resolve(import.meta.dirname,'../..');
assert(isAbsolute(receiptPath??'')&&isAbsolute(directory??'')&&!existsSync(directory));
const setup=JSON.parse(readFileSync(receiptPath)),device=disposableAndroidShell();
assert.equal(setup.case,'team-read-components');assert.equal(process.env.SGM_FOCUSED_UI_CASE,setup.case);
assert.equal(process.env.SGM_PREINSTALLED_TEST_APKS_RECEIPT,receiptPath);
const adb=resolve(process.env.ANDROID_HOME,'platform-tools/adb'),runId=randomBytes(16).toString('hex');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=[...nativeTeamAlertSources,'android/app/src/main/java/be/sportgreenmoove/app/ui/AppBottomBar.kt'];
const snapshot=()=>Object.fromEntries(sources.map(file=>[file,sha(readFileSync(resolve(root,file)))]));
const sourceFiles=snapshot();mkdirSync(directory);
assertLocalApkIdentity(resolve(root,'android'),process.env.ANDROID_HOME);assertContinuousDevice(device,setup);
const instrument=(name,count,extra=[])=>{
  let transcript;
  try{
    transcript=execFileSync(adb,['-s',device.serial,'shell','am','instrument','-w','-e','timeout_msec','180000',
      ...installationGuardArguments(),...extra,'-e','class',name,
      `be.sportgreenmoove.app.local.test/${disposableTestRunner}`],{encoding:'utf8',timeout:8*60_000,maxBuffer:4*1024*1024});
  }catch(error){if(error.stdout)writeFileSync(resolve(directory,'instrumentation-failed.txt'),String(error.stdout),{flag:'wx'});throw error;}
  writeFileSync(resolve(directory,name.split('.').at(-1)+'.txt'),transcript,{flag:'wx'});assertInstrumentationPassed(transcript,count);
  assert(!/^INSTRUMENTATION_STATUS_CODE:\s*-\d+\s*$/m.test(transcript),'Focused alert cases cannot be skipped or failed');
};
const trial=withDisposableNotificationPermission(device,()=>{
  instrument('be.sportgreenmoove.app.ui.TeamPushOpenFlowTest',8);
  instrument('be.sportgreenmoove.app.services.TeamPushPlatformFlowTest',4,['-e','sgmTeamAlertPlatform','true']);
  collectLocalUiEvidence({adb,serial:device.serial,evidenceDir:directory,phase:'team-alert-opening',runId,password:randomBytes(24).toString('hex')});
});
writeFileSync(resolve(directory,'notification-permission-restoration.json'),JSON.stringify(trial.receipt,null,2)+'\n',{flag:'wx'});
if(trial.failure)throw trial.failure;
assert.deepEqual(snapshot(),sourceFiles);assertContinuousDevice(device,setup);
const screenshots=Object.fromEntries(['team-alert-retry-narrow.png','team-alert-unavailable-wide-dark.png']
  .map(file=>[file,sha(readFileSync(resolve(directory,file)))]));
writeFileSync(resolve(directory,'team-alert-components-results.json'),JSON.stringify({
  scope:'isolated-native-alert-consumer-with-injected-resolver-not-provider-receipt',projectId:'demo-sgm-local-qa',runId,
  testedAt:new Date().toISOString(),componentCaseCount:8,platformCaseCount:4,nativeUiExecuted:true,
  nativeNotificationPosted:true,workerInvokedWithInjectedResolver:true,realMessagingSdkCalls:0,
  physicalDevice:false,pushDeliveryVerified:false,nativeNotificationTapVerified:false,productionWrites:false,
  sourceFiles,screenshots,setupReceiptSha256:sha(readFileSync(receiptPath)),notificationPermissionRestored:true,
  cleanupOwner:'focused-shell-independent-restoration-receipt-required'},null,2)+'\n',{flag:'wx'});
