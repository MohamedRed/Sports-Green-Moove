import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {disposableAndroidShell} from './disposable-android-shell.mjs';
import {requireFocusedDeviceApproval, preparePinnedApks, assertContinuousDevice} from './preinstalled-disposable-apks.mjs';
import {disposableTestRunner} from './install-disposable-test-apks.mjs';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

const className = 'be.sportgreenmoove.app.ui.TripChangeFlowTest';
const method = 'largeTextParentSeesBothVersionsAndAcceptsWithoutApplying';
export function runManualTripComponents({env=process.env,root=resolve(import.meta.dirname,'../..'),
  device,spawn=spawnSync,now=Date.now}={}) {
  requireFocusedDeviceApproval(env); assert.equal(env.SGM_FOCUSED_UI_CASE,'trip-change-components');
  const receiptPath=env.SGM_PREINSTALLED_TEST_APKS_RECEIPT;
  assert(receiptPath && isAbsolute(receiptPath));
  const directory=dirname(receiptPath), files=['component-preparation.json','component-instrumentation.txt',
    'component-process.json','component-results.json','component-crash.txt','component-crash-process.json'];
  for(const file of files) assert(!existsSync(resolve(directory,file)),'A diagnostic trial cannot overwrite or retry its evidence');
  device??=disposableAndroidShell(env);
  const receipt=JSON.parse(readFileSync(receiptPath));
  const preparation=preparePinnedApks({android:resolve(root,'android'),serial:device.serial,env,device});
  const save=(file,value)=>writeFileSync(resolve(directory,file),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  save('component-preparation.json',preparation);
  const adb=env.ANDROID_HOME?env.ANDROID_HOME+'/platform-tools/adb':'adb', started=now();
  const result=spawn(adb,['-s',device.serial,'shell','am','instrument','-w','-r','-e','class',className+'#'+method,
    '-e','timeout_msec','240000','-e','sgmBlockInstallations','true',`be.sportgreenmoove.app.test/${disposableTestRunner}`],
    {encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  const redact=value=>{
    let text=String(value??'');
    if(env.SGM_GOOGLE_MAPS_ANDROID_API_KEY) text=text.replaceAll(env.SGM_GOOGLE_MAPS_ANDROID_API_KEY,'[REDACTED]');
    return text.replace(/AIza[\w-]{20,}|Bearer\s+[\w.~+/-]+=*|eyJ[\w-]+\.[\w-]+\.[\w-]*/g,'[REDACTED]');
  };
  const transcript=redact(result.stdout); save('component-instrumentation.txt',transcript);
  save('component-process.json',{scope:'manual-component-command-not-full-matrix-proof',status:result.status,
    signal:result.signal,errorCode:result.error?'INSTRUMENTATION_PROCESS_ERROR':null,elapsedMs:now()-started,stderr:redact(result.stderr)});
  let parsed;
  try {
    assert.equal(result.status,0); assert.equal(result.signal,null); assert(!result.error);
    parsed=parseAndroidJUnitTranscript(transcript);
  } catch(failure) {
    const crash=spawn(adb,['-s',device.serial,'shell','logcat','-d','-b','crash','-v','brief','AndroidRuntime:E','*:S'],
      {encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
    save('component-crash.txt',redact(crash.stdout));
    save('component-crash-process.json',{status:crash.status,signal:crash.signal,errorCode:crash.error?'DIAGNOSTIC_PROCESS_ERROR':null});
    throw failure;
  }
  assert.equal(parsed.caseCount,1); assert.equal(parsed.cases[0].className,className); assert.equal(parsed.cases[0].name,method);
  assertContinuousDevice(device,receipt);
  const report={...parsed,scope:'single-trip-change-screen-diagnostic-not-full-matrix-or-release-proof',
    diagnosticScope:'single-trip-change-screen-only',fullMatrixAccepted:false,physicalDeviceAccepted:false};
  save('component-results.json',report);
  assert.equal(parsed.passed,1); assert.equal(parsed.failed,0); assert.equal(parsed.skipped,0);
  return report;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) runManualTripComponents();
