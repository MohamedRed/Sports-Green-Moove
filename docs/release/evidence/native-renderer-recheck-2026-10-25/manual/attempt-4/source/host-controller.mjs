import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, openSync, closeSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {resolve} from 'node:path';
const root = '/Users/mrr/.codex/projects/sports-green-moove-recovery-20261025';
const {prepareContinuousDevice, restoreContinuousDevice} = await import(root + '/scripts/qa/continuous-disposable-device.mjs');
const {disposableTestRunner} = await import(root + '/scripts/qa/install-disposable-test-apks.mjs');
const {parseAndroidJUnitTranscript} = await import(root + '/scripts/qa/android-junit-transcript.mjs');
const {preparePinnedApks} = await import(root + '/scripts/qa/preinstalled-disposable-apks.mjs');
const {waitForDisposableDevice} = await import(root + '/scripts/qa/disposable-device-cleanup.mjs');
const {runManualTripComponents} = await import(root + '/scripts/qa/run-manual-trip-components.mjs');
const sdk = '/Users/mrr/Library/Android/sdk', adb = sdk + '/platform-tools/adb';
const serial = 'emulator-5576', folder = '/Users/mrr/.codex/sgm-pixelcopy-repro-20261025-4';
assert(!existsSync(folder)); mkdirSync(folder);
const save = (name, value) => writeFileSync(resolve(folder, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', {flag:'wx'});
const command = args => {
  const out = spawnSync(adb, ['-s', serial, ...args], {encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  assert.equal(out.status, 0, 'Device command failed: ' + args[0]); return out.stdout.trim();
};
const device = {serial, shell:(...args)=>command(['shell',...args]), command:(...args)=>command(args)};
const log = openSync(resolve(folder, 'emulator.log'), 'wx');
const emulator = spawn(sdk + '/emulator/emulator', ['-avd','sgm_pixelcopy_repro_20261025_4','-port','5576',
  '-no-window','-gpu','software','-no-snapshot','-noaudio','-no-boot-anim','-memory','2560','-cores','2'],
  {stdio:['ignore',log,log]}); closeSync(log);
let exited = false; const finished = new Promise(resolve => emulator.once('exit',(code,signal)=>{exited=true;resolve({code,signal});}));
let receipt, outcome, failure;
try {
  const start = Date.now();
  while (true) {
    assert(!exited, 'Owned emulator exited before boot'); assert(Date.now()-start<180000, 'Owned emulator boot deadline reached');
    const ready = spawnSync(adb,['-s',serial,'shell','getprop','sys.boot_completed'],{encoding:'utf8',timeout:10000});
    if (ready.status===0 && ready.stdout.trim()==='1') break;
    await sleep(1000);
  }
  save('boot.json', {scope:'disposable-local-screen-reproduction-not-release-proof',serial,pid:emulator.pid,booted:true});
  waitForDisposableDevice(adb,serial);
  receipt = prepareContinuousDevice(process.env, undefined, {device}); save('setup.json',receipt);
  outcome=runManualTripComponents({device,env:{...process.env,SGM_PREINSTALLED_TEST_APKS_RECEIPT:resolve(folder,'setup.json')}});
  save('results.json',outcome);
  save('graphics.txt',device.shell('dumpsys','gfxinfo','be.sportgreenmoove.app'));
  const copy = spawnSync(adb,['-s',serial,'pull','/sdcard/Download/sgm-trip-changes',resolve(folder,'captures')],
    {encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  save('copy.json',{status:copy.status,signal:copy.signal,stdout:copy.stdout??'',stderr:copy.stderr??''});
} catch (error) {
  failure={name:error.name,message:error.message}; save('failure.json',failure);
  if(receipt)try {save('exit-info.txt',device.shell('dumpsys','activity','exit-info','be.sportgreenmoove.app'));}
  catch {save('exit-info-unavailable.json',{scope:'startup-diagnostic-only',collected:false});}
}
finally {
  if(receipt) {
    try {save('restoration.json',restoreContinuousDevice(device,receipt));}
    catch(error) {save('restoration-failure.json',error.receipt??{name:error.name,message:error.message});failure??={message:'Restoration failed'};}
  }
  if(!exited) {
    const stopped=spawnSync(adb,['-s',serial,'emu','kill'],{encoding:'utf8',timeout:10000});
    save('stop.json',{status:stopped.status,stdout:stopped.stdout??'',stderr:stopped.stderr??''});
  }
  const stopped=await Promise.race([finished,sleep(15000).then(()=>null)]);
  if(!stopped) {emulator.kill('SIGTERM'); await finished;}
  save('process-exit.json',{ownedPid:emulator.pid,exited});
}
console.log(JSON.stringify({folder,result:outcome?{passed:outcome.passed,failed:outcome.failed,skipped:outcome.skipped}:null,failure}));
process.exitCode = failure || !outcome || outcome.failed ? 1 : 0;
