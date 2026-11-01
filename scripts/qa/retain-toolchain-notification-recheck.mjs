import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,resolve} from 'node:path';
import {nativeTeamAlertSources} from './native-team-alert-sources.mjs';
import {pinnedTransferTools} from '../diagnostics/transfer-toolchain.mjs';

const root=resolve(import.meta.dirname,'../..'),[pinned,control,failed,notification]=process.argv.slice(2);
for(const path of [pinned,control,failed,notification])assert(isAbsolute(path??''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source='a55ed574a4717ab4f968d02c7a187be5271b37d9';
const base=resolve(root,'docs/release/evidence/toolchain-notification-recheck-2026-11-01');mkdirSync(base);
const hashes={},put=(name,bytes)=>{assert.doesNotMatch(bytes.toString(),/Bearer |refreshToken|idToken|installationSecret/);
  writeFileSync(resolve(base,name),bytes,{flag:'wx'});hashes[name]=sha(bytes);};
const archive=values=>Object.fromEntries(Object.entries(values).map(([file,bytes])=>{
  const hash=sha(bytes),path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);return[file,hash];
}));
const sourceFiles=archive(Object.fromEntries(['.github/workflows/android-transport-probe.yml',
  'scripts/diagnostics/transfer-toolchain.mjs','scripts/diagnostics/run-adb-transfer-probe.mjs',
  'scripts/diagnostics/adb-transfer-probe.mjs'].map(file=>[file,execFileSync('git',['show',source+':'+file],{cwd:root})])));
const originals=[{label:'pinned',path:pinned,run:41355051420,event:'workflow_dispatch',id:13102619642,
  digest:'757ec6ee7b63c88f25a9baf2cfdee5f77a261a8b8dec4bf2d932a292e26f3ed1'},
  {label:'control',path:control,run:41355057116,event:'pull_request',id:13102644449,
    digest:'24bb1a506763242aaba0ea671afbe5ad48ace3e670e9c1a7663241d37284c7d2'},
  {label:'failed',path:failed,run:41353565294,event:'pull_request',id:13102725679,
    digest:'b14c729b6079fd1338561d03b1ceaa2e3d7f64327e533a67ef7bbbec8c7eb511'}];
const json=(zip,name)=>JSON.parse(execFileSync('unzip',['-p',zip,name],{encoding:'utf8'}));
for(const item of originals){
  assert.equal(sha(readFileSync(item.path)),item.digest);
  const metadata=JSON.parse(execFileSync('gh',['api',`repos/MohamedRed/Sports-Green-Moove/actions/runs/${item.run}`],{encoding:'utf8'}));
  assert.equal(metadata.event,item.event);assert.equal(metadata.status,'completed');
  assert.equal(metadata.head_sha,item.label==='failed'?'84cb6b209a646d6420395110e4eb5f9023aed12f':source);
  assert.equal(metadata.conclusion,item.label==='failed'?'failure':'success');
  const result=json(item.path,'result.json'),env=json(item.path,'environment.json');
  assert.equal(result.success,item.label!=='failed');assert.equal(result.trials.length,item.label==='failed'?7:32);
  if(item.label==='pinned')assert.deepEqual(env.toolchain.archive,pinnedTransferTools);
  for(const file of ['result.json','environment.json'])put(item.label+'-'+file,execFileSync('unzip',['-p',item.path,file]));
}
const a=json(pinned,'environment.json'),b=json(control,'environment.json');assert.equal(a.versions.emulator,b.versions.emulator);
assert.equal(a.toolchain.installed.version,'36.0.2');assert.equal(b.toolchain.installed.version,'37.0.1');
assert.notEqual(a.toolchain.installed.adbSha256,b.toolchain.installed.adbSha256);
const nativeSource='84cb6b209a646d6420395110e4eb5f9023aed12f';
assert.equal(sha(readFileSync(notification)),'11f27ce6fe28da07e539460a4f677fb37bf5f71d226c2f580597f445df3d9076');
const names=execFileSync('unzip',['-Z1',notification],{encoding:'utf8'}).split('\n');
for(const [to,name]of [['routes.txt','TeamPushOpenFlowTest.txt'],['platform-failed.txt','TeamPushPlatformFlowTest.txt'],
  ['permission-restored.json','notification-permission-restoration.json'],['device-restored.json','disposable-device-restore.json']]){
  const paths=names.filter(path=>path.endsWith('/'+name));assert.equal(paths.length,1);put(to,execFileSync('unzip',['-p',notification,paths[0]]));
}
const originalNativeSources=archive(Object.fromEntries(nativeTeamAlertSources.map(file=>[file,
  execFileSync('git',['show',nativeSource+':'+file],{cwd:root})])));
const snapshot=()=>Object.fromEntries(nativeTeamAlertSources.map(file=>[file,readFileSync(resolve(root,file))]));
const before=archive(snapshot());
const build=spawnSync('./gradlew',[':app:assembleDebug',':app:assembleDebugAndroidTest',
  '-PSGM_USE_FIREBASE_EMULATOR=true','-PSGM_FIREBASE_EMULATOR_HOST=localhost','-PSGM_LOCAL_REAL_MAPS_UI=false','--no-daemon'],
  {cwd:resolve(root,'android'),encoding:'utf8',maxBuffer:8*1024*1024});
assert.ifError(build.error);assert.equal(build.status,0);assert.deepEqual(archive(snapshot()),before);
put('candidate-build.txt',((build.stdout??'')+(build.stderr??'')).split(homedir()).join('<home>'));
put('review.json',JSON.stringify({scope:'two-passing-transfer-comparisons-and-unexecuted-notification-observation-candidate',
  testedAt:new Date().toISOString(),comparisonSourceCommit:source,comparisonSources:sourceFiles,
  comparisons:originals.map(({path,...item})=>item),transferPassesPerComparison:32,priorDefaultPassedTransfers:6,
  versionCauseConfirmed:false,defaultProductToolchainChanged:false,wholeGatePassed:false,
  nativeFailure:{sourceCommit:nativeSource,runId:41353565190,jobId:124988732484,archiveId:13102109151,
    archiveSha256:'11f27ce6fe28da07e539460a4f677fb37bf5f71d226c2f580597f445df3d9076',routeCases:8,platformCases:4,failedPlatformCases:1,
    sourceFiles:originalNativeSources},
  candidate:{sourceFiles:before,sourceUnchangedDuringBuild:true,platformCasesCompiled:4,instrumentationExecuted:false,
    notificationObservationDeadlineMs:5000,notificationCommandsRetried:false,
    testApkSha256:sha(readFileSync(resolve(root,'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')))},
  providerRequests:0,physicalDevice:false,pushDeliveryVerified:false,nativeNotificationTapVerified:false,
  releaseAccepted:false,productionWrites:false,publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log('Retained both 32-transfer passes, prior failure, native removal failure and compiled observation candidate.');
