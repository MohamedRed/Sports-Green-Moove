import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),[input,aar,jar,observer,scenario]=process.argv.slice(2);
for(const path of [input,aar,jar,observer,scenario])assert(isAbsolute(path??''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source='b9a9000ea7bac1bc9e8a3f1f0d83f9eb01229378';
const digest='c496b674f0d5cf489bbebd62814eef841f8e87b45ebc1074b335149c8925ba89';
assert.equal(sha(readFileSync(input+'.zip')),digest);
assert.equal(sha(readFileSync(aar)),'7a7af31c21785ddb7c4319c838847e6d4d9b5bb531f3a951481ec3b98780bf51');
assert.equal(sha(readFileSync(jar)),'693f6c75904659814cbc4204feae956376817e247597efd7997abcbb1e55737c');
const base=resolve(root,'docs/release/evidence/foreground-return-intent-b9a9000-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md']);else mkdirSync(base);
const hashes={},put=(file,bytes)=>{writeFileSync(resolve(base,file),bytes,{flag:'wx'});hashes[file]=sha(bytes);};
const archive=values=>Object.fromEntries(Object.entries(values).map(([file,bytes])=>{
  const hash=sha(bytes),path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);return[file,hash];
}));
const ui='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
const paths=[ui+'LocalRemoteRideStopFlowTest.kt',ui+'ForegroundReturnIntent.kt',ui+'ForegroundReturnIntentTest.kt',ui+'ObservedActivityStage.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt','android/app/src/main/AndroidManifest.xml','android/app/build.gradle.kts'];
const snapshot=()=>Object.fromEntries(paths.map(file=>[file,sha(readFileSync(resolve(root,file)))]));
const before=snapshot();archive(Object.fromEntries(paths.map(file=>[file,readFileSync(resolve(root,file))])));
const originalSourceFiles=archive(Object.fromEntries([paths[0],paths[4]].map(file=>[
  file,execFileSync('git',['show',source+':'+file],{cwd:root})])));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(row=>row.isDirectory()?walk(resolve(dir,row.name)):[resolve(dir,row.name)]);
const one=name=>{const rows=walk(input).filter(path=>path.endsWith('/'+name));assert.equal(rows.length,1,name);return rows[0];};
for(const [file,name]of [['failed-instrumentation.txt','LocalRemoteRideStopFlowTest-instrumentation.txt'],
  ['checkpoint.json','local-remote-ride-stop-checkpoint.json'],['device-restoration.json','disposable-device-restore.json']]){
  const bytes=readFileSync(one(name));assert.doesNotMatch(bytes.toString(),/Bearer |idToken|refreshToken|installationSecret|synthetic_token_/i);put(file,bytes);
}
const observerText=readFileSync(observer,'utf8'),scenarioText=readFileSync(scenario,'utf8');
assert(observerText.includes('intent does not match'));assert(observerText.includes('Activity.getIntent'));
const method=scenarioText.slice(scenarioText.indexOf('  private static boolean activityMatchesIntent('),
  scenarioText.indexOf('  private static boolean hasPackageEquivalentComponent('));
for(const name of ['getAction','getData','getType','getPackage','getComponent','getCategories','getIdentifier'])assert(method.includes(name));
put('library-intent-match.txt',method);put('library-observer-filter.txt',observerText);
const build=spawnSync('./gradlew',[':app:assembleDebugAndroidTest','-PSGM_USE_FIREBASE_EMULATOR=true',
  '-PSGM_FIREBASE_EMULATOR_HOST=localhost','-PSGM_LOCAL_REAL_MAPS_UI=false','--no-daemon'],{cwd:resolve(root,'android'),encoding:'utf8',maxBuffer:8*1024*1024});
assert.ifError(build.error);assert.equal(build.status,0);assert.deepEqual(snapshot(),before);
put('candidate-build.txt',((build.stdout??'')+(build.stderr??'')).split(homedir()).join('<home>'));
const run=JSON.parse(execFileSync('gh',['api','repos/MohamedRed/Sports-Green-Moove/actions/runs/41349573814'],{encoding:'utf8'}));
assert.equal(run.head_sha,source);
put('review.json',JSON.stringify({scope:'source-supported-foreground-intent-mismatch-not-verified-native-replay',
  reviewedAt:new Date().toISOString(),sourceCommit:source,runId:41349573814,jobId:124976643675,runStatusAtInspection:run.status,
  archive:{id:13100434670,sha256:digest},previousTeardownCandidateFailed:true,
  library:{module:'androidx.test:core:1.6.1',aarSha256:sha(readFileSync(aar)),classesSha256:sha(readFileSync(jar))},
  originalSourceFiles,candidate:{sourceFiles:before,sourceUnchangedDuringBuild:true,nativeCasesCompiled:2,nativeCasesExecuted:false,
    testApkSha256:sha(readFileSync(resolve(root,'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')))},
  sourceSupportedCause:true,rootCauseReproducedInIsolation:false,correctedRemoteTrialPassed:false,wholeGatePassed:false,
  physicalDevice:false,pushDeliveryVerified:false,releaseAccepted:false,providerRequests:0,productionWrites:false,publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log('Retained repeated teardown failure, installed-library intent matching and compiled candidate; no native pass inferred.');
