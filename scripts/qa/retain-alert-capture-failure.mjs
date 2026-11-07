import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseAndroidJUnitTranscript} from './android-junit-transcript.mjs';

const root=resolve(import.meta.dirname,'../..'),[download,metadata]=process.argv.slice(2);
assert([download,metadata].every(path=>isAbsolute(path??'')));
const run=JSON.parse(readFileSync(resolve(metadata,'native-run.json')));
assert.equal(run.headSha,'406e414c66bdb17d73765a19499f45c66d8cd9dd');
assert.equal(run.databaseId,41296148302);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
const base=resolve(root,'docs/release/evidence/alert-capture-failure-406e414-2026-11-01');
assert(!existsSync(base));mkdirSync(base);
const ordinary='outputs/store-review-screenshots/',replay='outputs/local-ui-evidence/1167ac913adf7fe9564a946abbb6115a/';
const files={
  'ordinary-instrumentation.txt':ordinary+'ordinary-instrumentation.txt','ordinary-results.json':ordinary+'ordinary-results.json',
  'native-suite-status.json':ordinary+'native-suite-status.json','device-restoration.json':ordinary+'disposable-store-restore.json',
  'rejected-primary-copy.json':ordinary+'ordinary-failure/rejected-primary-copy.json',
  'primary-copy.json':replay+'adb-pull-confirmed-restart.json',
  'sync-diagnostics.json':replay+'adb-sync-confirmed-restart-diagnostics.json',
  'guarded-components.xml':'outputs/androidTest-results/connected/debug/TEST-guarded-components.xml',
};
for(const [target,source] of Object.entries(files))copyFileSync(resolve(download,source),resolve(base,target));
for(const [target,source] of [['native-run.json','native-run.json'],['artifact.json','main-artifact.json']])
  copyFileSync(resolve(metadata,source),resolve(base,target));
const parsed=parseAndroidJUnitTranscript(readFileSync(resolve(base,'ordinary-instrumentation.txt'),'utf8'));
assert.deepEqual([parsed.passed,parsed.skipped,parsed.failed],[225,54,1]);
const sources=['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NotificationInboxFlowTest.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/RejectedPrimaryBitmap.kt',
  'scripts/qa/rejected-primary-captures.mjs','scripts/qa/collect-local-ui-evidence.mjs','scripts/qa/local-android-session.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const archive=resolve(root,'docs/release/evidence/source-archive');mkdirSync(archive,{recursive:true});
const sourceFiles=Object.fromEntries(sources.map(file=>{
  const bytes=execFileSync('git',['show',run.headSha+':'+file],{cwd:root}),hash=sha(bytes),target=resolve(archive,hash+'.txt');
  if(!existsSync(target))writeFileSync(target,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(target)),hash);
  return[file,hash];
}));
writeFileSync(resolve(base,'review.json'),JSON.stringify({
  scope:'failed-native-alert-capture-and-restart-copy-not-release-proof',testedAt:'2026-11-01',
  headSha:run.headSha,workflowId:run.databaseId,sourceFiles,ordinary: {passed:parsed.passed,skipped:parsed.skipped,failed:parsed.failed},
  notificationCasesPassed:3,notificationCaseRejectedAtCapture:true,rejectedBitmapRetained:false,
  finalReplayReportPresent:existsSync(resolve(download,replay,'results.json')),
  sourceArchiveCompleteHeadAttestation:false,downloadedArchiveDigestIndependentlyVerified:false,
  rootCauseProven:false,repairVerified:false,pushDeliveryVerified:false,physicalPhoneEvidenceOverridden:false,
  releaseAccepted:false,publishedCaptures:{},
},null,2)+'\n',{flag:'wx'});
const names=[...Object.keys(files),'native-run.json','artifact.json','review.json'];
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(names.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])),null,2)+'\n',{flag:'wx'});
console.log('Retained the failed 280-case run and disconnected primary copy without promoting delivery or release evidence.');
