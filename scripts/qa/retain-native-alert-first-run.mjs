import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,resolve} from 'node:path';
import {XMLParser,XMLBuilder} from 'fast-xml-parser';
import {nativeTeamAlertSources} from './native-team-alert-sources.mjs';

const root=resolve(import.meta.dirname,'../..'),[alerts,remote,output]=process.argv.slice(2);
for(const path of [alerts,remote,output])assert(isAbsolute(path??''));assert(!existsSync(output));mkdirSync(output);
const source='b85076e033da6d09b8fa297cba2124fb1a6a981b',runId=41345045637;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=path=>JSON.parse(readFileSync(path));
const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(row=>row.isDirectory()?walk(resolve(directory,row.name)):[resolve(directory,row.name)]);
const one=(directory,name)=>{const files=walk(directory).filter(path=>path.endsWith('/'+name));assert.equal(files.length,1,name);return files[0];};
const metadata=JSON.parse(execFileSync('gh',['api',`repos/MohamedRed/Sports-Green-Moove/actions/runs/${runId}`],{encoding:'utf8'}));
assert.equal(metadata.head_sha,source);
const originals={
  'alert-instrumentation.txt':one(alerts,'TeamPushOpenFlowTest.txt'),
  'alert-permission-restoration.json':one(alerts,'notification-permission-restoration.json'),
  'alert-device-restoration.json':one(alerts,'disposable-device-restore.json'),
  'remote-instrumentation.txt':one(remote,'LocalRemoteRideStopFlowTest-instrumentation.txt'),
  'remote-device-restoration.json':one(remote,'disposable-device-restore.json'),
  'remote-checkpoint.json':one(remote,'local-remote-ride-stop-checkpoint.json'),
};
assert.match(readFileSync(originals['alert-instrumentation.txt'],'utf8'),/Tests run: 7,\s+Failures: 2/);
assert.match(readFileSync(originals['alert-instrumentation.txt'],'utf8'),/V2ThemeToggleProvider is missing/);
assert.match(readFileSync(originals['remote-instrumentation.txt'],'utf8'),/ActivityScenario.getState/);
assert.equal(json(originals['alert-permission-restoration.json']).restored,true);
for(const key of ['alert-device-restoration.json','remote-device-restoration.json'])assert.equal(json(originals[key]).verified,true);
const archives=[{id:13099136586,name:'android-focused-safety-ui-team-read-components',sha256:'c8793ddddb92d1a3ed1829e94fd0d87d614993277b981c7657eb6b18cbe46ac2',directory:alerts},
  {id:13099296946,name:'android-focused-safety-ui-remote-ride-stop',sha256:'03816f74456e6b981fb6084e1360da07d34c8e816516246da9c239a52654d0c6',directory:remote}];
for(const archive of archives)assert.equal(sha(readFileSync(archive.directory+'.zip')),archive.sha256);
const main='android/app/src/main/java/be/sportgreenmoove/app/ui/',test='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const changed=[main+'SportsGreenMooveApp.kt',main+'AppBottomBar.kt',test+'TeamPushOpenFlowTest.kt',
  test+'LocalRemoteRideStopFlowTest.kt',test+'ObservedActivityStage.kt','scripts/qa/run-team-alert-components.mjs'];
const paths=[...new Set([...nativeTeamAlertSources,...changed,'scripts/qa/retain-native-alert-first-run.mjs'])];
const snapshot=()=>Object.fromEntries(paths.map(file=>[file,sha(readFileSync(resolve(root,file)))]));
const candidateSources=snapshot(),startedAt=new Date().toISOString();
const args=[':app:testDebugUnitTest',':app:assembleDebug',':app:assembleDebugAndroidTest','-PSGM_USE_FIREBASE_EMULATOR=true',
  '-PSGM_FIREBASE_EMULATOR_HOST=localhost','-PSGM_LOCAL_REAL_MAPS_UI=false','--no-daemon','--rerun-tasks'];
const build=spawnSync('./gradlew',args,{cwd:resolve(root,'android'),encoding:'utf8',maxBuffer:16*1024*1024});
const log=(build.stdout??'')+(build.stderr??'');writeFileSync(resolve(output,'build.log'),log,{flag:'wx'});
assert.ifError(build.error);assert.equal(build.status,0);assert(log.includes('BUILD SUCCESSFUL'));assert.deepEqual(snapshot(),candidateSources);
const parser=new XMLParser({ignoreAttributes:false}),builder=new XMLBuilder({ignoreAttributes:false,format:true});
const junit=resolve(root,'android/app/build/test-results/testDebugUnitTest');
const suites=readdirSync(junit).filter(file=>file.endsWith('.xml')).map(file=>({file,value:parser.parse(readFileSync(resolve(junit,file))).testsuite}));
for(const {value}of suites)for(const key of ['failures','errors','skipped'])assert.equal(Number(value['@_'+key]),0);
assert.equal(suites.reduce((sum,row)=>sum+Number(row.value['@_tests']),0),790);
const base=resolve(root,'docs/release/evidence/native-alert-first-run-b85076e-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md']);else mkdirSync(base);
const artifacts={},put=(file,bytes)=>{writeFileSync(resolve(base,file),bytes,{flag:'wx'});artifacts[file]=sha(bytes);};
for(const [name,path]of Object.entries(originals)){
  const bytes=readFileSync(path);assert.doesNotMatch(bytes.toString(),/Bearer |idToken|refreshToken|installationSecret|synthetic_token_/i);put(name,bytes);
}
const originalSources=Object.fromEntries(changed.filter(file=>!file.endsWith('ObservedActivityStage.kt')).map(file=>[
  file,execFileSync('git',['show',source+':'+file],{cwd:root})]));
const archiveSources=values=>Object.fromEntries(Object.entries(values).map(([file,bytes])=>{
  const hash=sha(bytes),path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);return[file,hash];
}));
const originalSourceFiles=archiveSources(originalSources);
archiveSources(Object.fromEntries(paths.map(file=>[file,readFileSync(resolve(root,file))])));
for(const [name,count]of [['services.TeamPushAlertTest',13],['ui.TeamPushOpenStateTest',7]]){
  const {file,value}=suites.find(row=>row.value['@_name']==='be.sportgreenmoove.app.'+name);assert.equal(Number(value['@_tests']),count);
  value['@_hostname']='local-test-host';put(file,builder.build({testsuite:value}).split(homedir()).join('<home>'));
}
const apk=file=>{const bytes=readFileSync(resolve(root,'android/app/build/outputs/apk',file));return{sha256:sha(bytes),bytes:bytes.length};};
put('candidate-build.txt',log.split(homedir()).join('<home>'));
put('review.json',JSON.stringify({scope:'failed-native-alert-hosts-and-candidate-compile-not-verified-replay',testedAt:new Date().toISOString(),startedAt,
  runId,sourceCommit:source,runStatusAtInspection:metadata.status,fullGatePassed:false,
  alertCases:{total:7,passed:5,failed:2,platformExecuted:false},remoteCasePassed:false,remoteForegroundReturnVerified:false,
  permissionRestored:true,deviceRestorationVerified:true,archives:archives.map(({directory,...row})=>row),originalSourceFiles,
  candidate:{sourceFiles:candidateSources,sourceUnchangedDuringBuild:true,unitTests:790,focusedUnitTests:20,nativeUiCasesCompiled:12,
    app:apk('debug/app-debug.apk'),testApp:apk('androidTest/debug/app-debug-androidTest.apk'),instrumentationExecuted:false},
  nativeNotificationPosted:false,nativeNotificationTapVerified:false,pushDeliveryVerified:false,physicalDevice:false,realMessagingSdkCalls:0,
  releaseAccepted:false,productionWrites:false,publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(artifacts,null,2)+'\n',{flag:'wx'});
console.log('Retained original 5/7 alert cases, unexecuted platform work, failed foreground return and source-bound candidate compilation.');
