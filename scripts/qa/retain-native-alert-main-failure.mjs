import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';

const [input]=process.argv.slice(2);assert(isAbsolute(input??''));
const root=resolve(import.meta.dirname,'../..');
const base=resolve(root,'docs/release/evidence/native-alert-first-run-b85076e-2026-11-01');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest='2f832d1a6676b4c349362494b59c4a6011d28ffdbd7ff425099a36b97cd83dd9';
assert.equal(sha(readFileSync(input+'.zip')),digest);
const local='outputs/local-ui-evidence/108a2cfe67af41585f123e44ce2c6c73/';
const originals={
  'main-ordinary.xml':'outputs/androidTest-results/connected/debug/TEST-guarded-components.xml',
  'main-guardian-instrumentation.txt':local+'LocalGuardianVerificationFlowTest-instrumentation.txt',
  'main-copy-failure-cleanup.json':local+'adb-pull-failure-cleanup.json',
};
const artifacts=JSON.parse(readFileSync(resolve(base,'artifact-sha256.json')));
const put=(file,bytes)=>{
  assert.doesNotMatch(bytes.toString(),/Bearer |idToken|refreshToken|installationSecret|synthetic_token_/i);
  writeFileSync(resolve(base,file),bytes,{flag:'wx'});artifacts[file]=sha(bytes);
};
const parser=new XMLParser({ignoreAttributes:false});
const suite=parser.parse(readFileSync(resolve(input,originals['main-ordinary.xml']))).testsuite;
assert.equal(Number(suite['@_tests']),300);assert.equal(Number(suite['@_skipped']),55);
const failures=suite.testcase.filter(row=>row.failure);
assert.equal(failures.length,2);
assert(failures.every(row=>row['@_classname']==='be.sportgreenmoove.app.ui.TeamPushOpenFlowTest'));
const transcript=readFileSync(resolve(input,originals['main-guardian-instrumentation.txt']),'utf8');
assert.match(transcript,/Tests run: 1,\s+Failures: 1/);
assert.match(transcript,/login\(LocalGuardianVerificationFlowTest.kt:87\)/);
const copy=JSON.parse(readFileSync(resolve(input,originals['main-copy-failure-cleanup.json'])));
assert.equal(copy.completed,false);assert.equal(copy.status,1);
assert.match(copy.stderr,/failed to stat remote object .*No such file or directory/);
for(const [name,file]of Object.entries(originals))put(name,readFileSync(resolve(input,file)));
put('main-review.json',JSON.stringify({scope:'failed-main-native-gate-not-verified-login-or-transport-cause',
  sourceCommit:'b85076e033da6d09b8fa297cba2124fb1a6a981b',runId:41345045637,jobId:124962966296,
  reviewedAt:new Date().toISOString(),archive:{id:13099119008,sha256:digest},
  ordinary:{total:300,passed:243,skipped:55,failed:2},
  failedOrdinaryCases:failures.map(row=>row['@_name']),
  guardian:{total:1,passed:0,failed:1,firstAuthScreenReached:false,rootCauseVerified:false},
  cleanupCopy:{completed:false,remoteDirectoryMissing:true,transportFailureProven:false},
  fullGatePassed:false,releaseAccepted:false,publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(artifacts,null,2)+'\n');
console.log('Retained main-gate failures separately; no login, transfer or release success inferred.');
