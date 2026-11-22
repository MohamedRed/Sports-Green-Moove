import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,resolve} from 'node:path';
import {XMLParser,XMLBuilder} from 'fast-xml-parser';

const root=resolve(import.meta.dirname,'../..'),[services,units,alerts,remote,initialLog,initialSource]=process.argv.slice(2);
for(const path of [services,units,alerts,remote,initialLog,initialSource])assert(isAbsolute(path??''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source='11c423b6cd49e652e7d228130eddcad2dd7f03fd';
const report=JSON.parse(readFileSync(services));assert.equal(report.steps.length,14);assert(report.completed);
for(const [file,hash]of Object.entries(report.sourceFiles))assert.equal(sha(readFileSync(resolve(root,file))),hash,file);
const base=resolve(root,'docs/release/evidence/team-push-dispatch-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md']);else mkdirSync(base);
const hashes={},put=(file,bytes)=>{writeFileSync(resolve(base,file),bytes,{flag:'wx'});hashes[file]=sha(bytes);};
const archive=values=>Object.fromEntries(Object.entries(values).map(([file,bytes])=>{
  const hash=sha(bytes),path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);return[file,hash];
}));
archive(Object.fromEntries(Object.keys(report.sourceFiles).map(file=>[file,readFileSync(resolve(root,file))])));
put('services.json',readFileSync(services));
const parser=new XMLParser({ignoreAttributes:false}),builder=new XMLBuilder({ignoreAttributes:false,format:true});
const all=parser.parse(readFileSync(units)).testsuites;assert.equal(Number(all['@_tests']),611);assert.equal(Number(all['@_failures']),0);
const unit=all.testsuite.find(row=>row['@_name']==='src/__tests__/team-push-dispatch.test.ts');
assert.equal(Number(unit['@_tests']),22);assert.equal(Number(unit['@_failures']),0);unit['@_hostname']='local-test-host';
put('dispatch-unit.xml',builder.build({testsuite:unit}));
const initial=readFileSync(initialLog,'utf8').split(homedir()).join('<home>');
assert.match(initial,/local-team-push-dispatch-suite.mjs:98:39/);assert.match(initial,/AssertionError/);
assert.doesNotMatch(initial,/Bearer |idToken|refreshToken|installationSecret|synthetic_token_/i);
put('initial-expiry-fixture-failure.txt',initial);
const firstSource=archive({'scripts/qa/local-team-push-dispatch-suite.mjs':readFileSync(initialSource)});
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(row=>row.isDirectory()?walk(resolve(dir,row.name)):[resolve(dir,row.name)]);
const one=(dir,name)=>{const rows=walk(dir).filter(path=>path.endsWith('/'+name));assert.equal(rows.length,1,name);return rows[0];};
const archives=[{id:13100227677,sha256:'0a470628f133b5052199a9fe8b5a770f0ca45e10ca529097b62ee2aa735a1ba6',dir:alerts},
  {id:13100043476,sha256:'f78f9b4ef5c3b422cff83d7fd4f02e211448ba4711e980314d087c4c9cd20079',dir:remote}];
for(const row of archives)assert.equal(sha(readFileSync(row.dir+'.zip')),row.sha256);
const native=JSON.parse(readFileSync(one(alerts,'team-alert-components-results.json')));
const nativeSources=archive(Object.fromEntries(Object.keys(native.sourceFiles).map(file=>[file,execFileSync('git',['show',source+':'+file],{cwd:root})])));
assert.deepEqual(native.sourceFiles,nativeSources);
for(const [name,dir,file]of [['native-results.json',alerts,'team-alert-components-results.json'],
  ['native-route.txt',alerts,'TeamPushOpenFlowTest.txt'],['native-platform.txt',alerts,'TeamPushPlatformFlowTest.txt'],
  ['native-permission.json',alerts,'notification-permission-restoration.json'],['native-restore.json',alerts,'disposable-device-restore.json'],
  ['native-copy.json',alerts,'adb-pull-team-alert-opening.json'],
  ['remote-transcript.txt',remote,'LocalRemoteRideStopFlowTest-instrumentation.txt'],
  ['remote-checkpoint.json',remote,'local-remote-ride-stop-checkpoint.json'],['remote-restore.json',remote,'disposable-device-restore.json']]){
  const bytes=readFileSync(one(dir,file));assert.doesNotMatch(bytes.toString(),/Bearer |idToken|refreshToken|installationSecret|synthetic_token_/i);put(name,bytes);
}
const ui='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const files=[ui+'LocalRemoteRideStopFlowTest.kt',ui+'ObservedActivityStage.kt'];
const before=archive(Object.fromEntries(files.map(file=>[file,readFileSync(resolve(root,file))])));
const build=spawnSync('./gradlew',[':app:assembleDebug',':app:assembleDebugAndroidTest','-PSGM_USE_FIREBASE_EMULATOR=true',
  '-PSGM_FIREBASE_EMULATOR_HOST=localhost','-PSGM_LOCAL_REAL_MAPS_UI=false','--no-daemon'],{cwd:resolve(root,'android'),encoding:'utf8',maxBuffer:8*1024*1024});
assert.ifError(build.error);assert.equal(build.status,0);
for(const [file,hash]of Object.entries(before))assert.equal(sha(readFileSync(resolve(root,file))),hash);
put('teardown-build.txt',((build.stdout??'')+(build.stderr??'')).split(homedir()).join('<home>'));
const metadata=JSON.parse(execFileSync('gh',['api',`repos/MohamedRed/Sports-Green-Moove/actions/runs/41347838315`],{encoding:'utf8'}));
assert.equal(metadata.head_sha,source);
put('review.json',JSON.stringify({scope:'isolated-dispatch-and-native-consumer-components-not-delivery-or-release',testedAt:new Date().toISOString(),
  serviceCases:14,backendUnitTests:611,focusedUnitTests:22,dispatcherImplemented:true,productionDeployed:false,
  providerRequests:0,pushDeliveryVerified:false,nativeNotificationTapVerified:false,physicalDevice:false,releaseAccepted:false,
  initialFixtureSourceFiles:firstSource,native:{sourceCommit:source,runId:41347838315,runStatusAtInspection:metadata.status,
    routeCases:8,platformCases:4,nativeNotificationPosted:true,injectedResolver:true,realMessagingSdkCalls:0,
    remoteTrialPassed:false,remoteFinalMarkerWritten:false,wholeGatePassed:false,
    archives:archives.map(({dir,...row})=>row)},
  teardownCandidate:{sourceFiles:before,sourceUnchangedDuringBuild:true,instrumentationExecuted:false,
    testApkSha256:sha(readFileSync(resolve(root,'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')))},
  publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log('Retained 14 isolated dispatch cases, 22 unit cases, 12 native components and the separate teardown failure.');
