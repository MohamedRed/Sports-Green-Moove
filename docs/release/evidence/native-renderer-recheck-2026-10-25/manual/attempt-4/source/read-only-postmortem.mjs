import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,openSync,closeSync,writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
const sdk='/Users/mrr/Library/Android/sdk',adb=sdk+'/platform-tools/adb';
const folder='/Users/mrr/.codex/sgm-pixelcopy-repro-20261025-4';
assert(!existsSync(folder+'/postmortem-dropbox.txt'));
const log=openSync(folder+'/postmortem-emulator.log','wx');
const child=spawn(sdk+'/emulator/emulator',['-avd','sgm_pixelcopy_repro_20261025_4','-port','5576',
  '-no-window','-gpu','software','-no-snapshot','-noaudio','-no-boot-anim','-memory','2560','-cores','2'],{stdio:['ignore',log,log]});closeSync(log);
let exited=false;const finished=new Promise(r=>child.once('exit',(code,signal)=>{exited=true;r({code,signal});}));
const save=(name,value)=>writeFileSync(folder+'/'+name,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
let collected=false;
try{
  const start=Date.now();while(true){assert(!exited);assert(Date.now()-start<150000);
    const r=spawnSync(adb,['-s','emulator-5576','shell','getprop','sys.boot_completed'],{encoding:'utf8',timeout:10000});
    if(r.status===0&&r.stdout.trim()==='1')break;await sleep(1000);}
  const r=spawnSync(adb,['-s','emulator-5576','shell','dumpsys','dropbox','--print','data_app_anr'],
    {encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  save('postmortem-dropbox.txt',r.stdout??'');collected=r.status===0;
  save('postmortem-command.json',{scope:'read-only-owned-disposable-startup-anr-not-flow-proof',status:r.status,signal:r.signal,
    errorCode:r.error?.code??null,appInstalledOrExecuted:false});
}finally{
  if(!exited)spawnSync(adb,['-s','emulator-5576','emu','kill'],{encoding:'utf8',timeout:10000});
  const timer=new AbortController();
  const outcome=await Promise.race([finished,sleep(15000,null,{signal:timer.signal}).catch(()=>null)]);timer.abort();
  if(!outcome){child.kill('SIGTERM');await finished;}
  save('postmortem-exit.json',{ownedPid:child.pid,exited});
}
console.log(JSON.stringify({collected,exited}));
