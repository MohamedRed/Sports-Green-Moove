import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {XMLParser} from 'fast-xml-parser';

const root=resolve(import.meta.dirname,'../..'),trial=process.argv[2],buildLog=process.argv[3];
assert(isAbsolute(trial??'')&&isAbsolute(buildLog??''));
const log=readFileSync(buildLog,'utf8');assert(log.includes('BUILD SUCCESSFUL'));
assert(log.includes(':app:assembleDebugAndroidTest')&&log.includes(':app:assembleDebug'));
const filename=process.argv[4]??'sgm-team-alert-inbox-local.apk';assert(/^[a-z0-9-]+\.apk$/.test(filename));
const apk=resolve(trial,filename),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(readFileSync(apk)),sha(readFileSync(resolve(root,'android/app/build/outputs/apk/debug/app-debug.apk'))));
const tool=resolve(process.env.ANDROID_HOME,'build-tools/36.0.0/aapt');
const badging=execFileSync(tool,['dump','badging',apk],{encoding:'utf8'});
assert(badging.includes("package: name='be.sportgreenmoove.app.local'"));
const configuration=readFileSync(resolve(root,'android/app/build/generated/source/buildConfig/debug/be/sportgreenmoove/app/BuildConfig.java'),'utf8');
assert(configuration.includes('SGM_USE_FIREBASE_EMULATOR = true'));
assert(configuration.includes('SGM_FIREBASE_EMULATOR_HOST = "localhost"'));
const parser=new XMLParser({ignoreAttributes:false}),folder=resolve(root,'android/app/build/test-results/testDebugUnitTest');
const suites=readdirSync(folder).filter(name=>name.endsWith('.xml')).map(name=>({file:name,value:parser.parse(readFileSync(resolve(folder,name))).testsuite}));
const sum=key=>suites.reduce((count,row)=>count+Number(row.value['@_'+key]),0);
assert.equal(sum('failures'),0);assert.equal(sum('errors'),0);assert.equal(sum('skipped'),0);
const focused=suites.filter(row=>/NotificationInboxStateTest|NotificationInboxWireTest|MessagesNotificationPollingTest/.test(row.value['@_name']));
const focusedTests=focused.reduce((count,row)=>count+Number(row.value['@_tests']),0);
assert.equal(focused.length,3);assert.equal(focusedTests,13);
for(const row of focused)copyFileSync(resolve(folder,row.file),resolve(trial,row.file));
const paths=['services/FirebaseAndroidNotificationInboxGateway.kt','services/NotificationInboxGateway.kt','services/FirebaseAndroidGateway.kt',
  'services/ProviderContracts.kt','services/FirebaseAndroidRuntime.kt','ui/NotificationInboxState.kt','ui/NotificationInboxContent.kt',
  'ui/MessagesInboxState.kt','ui/MessagesInboxRoute.kt'];
const sources=[...paths.map(file=>'android/app/src/main/java/be/sportgreenmoove/app/'+file),'android/app/build.gradle.kts',
  'android/app/src/main/AndroidManifest.xml','android/app/src/localDebug/AndroidManifest.xml',
  'android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt'];
writeFileSync(resolve(trial,'build.json'),JSON.stringify({recordedAt:new Date().toISOString(),scope:'local-android-build-and-jvm-not-installed-apk-or-ui-execution',
  apk:{filename,sha256:sha(readFileSync(apk)),bytes:readFileSync(apk).length,package:'be.sportgreenmoove.app.local'},
  emulatorHost:'localhost',projectId:'demo-sgm-local-qa',unitSuites:suites.length,unitTests:sum('tests'),focusedUnitTests:focusedTests,
  installedApkIndependentlyHashed:false,componentTestsCompiled:true,componentTestsExecuted:false,pushDeliveryVerified:false,
  sourceFiles:Object.fromEntries(sources.map(file=>[file,sha(readFileSync(resolve(root,file)))])),
  junitFiles:Object.fromEntries(focused.map(row=>[row.file,sha(readFileSync(resolve(folder,row.file)))]))
},null,2)+'\n',{flag:'wx'});
console.log('Recorded isolated APK provenance, thirteen focused JVM tests and the complete local unit result.');
