import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';

const root=resolve(import.meta.dirname,'../..'),[zip]=process.argv.slice(2);assert(isAbsolute(zip??''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest='adccffd0c00ce84d2c16a2240691aa74ca40d766b4d30f00bfb6390ff91aa53d';assert.equal(sha(readFileSync(zip)),digest);
const source='93d9138f71f9db4c315f6733448666d19e2e638b';
const job=JSON.parse(execFileSync('gh',['api','repos/MohamedRed/Sports-Green-Moove/actions/jobs/124982776166'],{encoding:'utf8'}));
assert.equal(job.head_sha,source);assert.equal(job.conclusion,'success');
const names=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).split('\n');
const read=name=>{const paths=names.filter(path=>path.endsWith('/'+name));assert.equal(paths.length,1,name);
  return execFileSync('unzip',['-p',zip,paths[0]]);};
const base=resolve(root,'docs/release/evidence/foreground-return-pass-93d9138-2026-11-01');mkdirSync(base);
const hashes={},put=(file,bytes)=>{writeFileSync(resolve(base,file),bytes,{flag:'wx'});hashes[file]=sha(bytes);};
const report=JSON.parse(read('remote-ride-stop-results.json'));
assert.equal(report.nativeUiExecuted,true);assert.equal(report.backgroundStopBeforeResume,true);assert.equal(report.isolatedEnvironmentDestroyed,true);
for(const [file,hash]of Object.entries(report.sourceFiles)){
  const bytes=execFileSync('git',['show',source+':'+file],{cwd:root});assert.equal(sha(bytes),hash,file);
  const path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);
}
for(const name of ['ForegroundReturnIntentTest-instrumentation.txt','LocalRemoteRideStopFlowTest-instrumentation.txt',
  'remote-ride-stop-results.json','local-remote-ride-stop-checkpoint.json','adb-pull-remote-ride-stop.json',
  'remote-ride-stop-suite-status.json','disposable-device-restore.json'])put(name,read(name));
assert.match(read('ForegroundReturnIntentTest-instrumentation.txt').toString(),/OK \(2 tests\)/);
assert.match(read('LocalRemoteRideStopFlowTest-instrumentation.txt').toString(),/OK \(1 test\)/);
put('review.json',JSON.stringify({scope:'isolated-native-foreground-return-pass-not-physical-or-full-gate',testedAt:report.testedAt,
  sourceCommit:source,runId:41351599563,jobId:124982776166,jobConclusion:'success',
  archive:{id:13101791762,sha256:digest},frameworkCases:2,connectedRideCases:1,
  correctedRemoteTrialPassed:true,wholeGatePassed:false,physicalDevice:false,providerTrackingVerified:false,
  releaseAccepted:false,productionWrites:false,publishedCaptures:{}},null,2)+'\n');
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log('Retained two native framework passes and the connected ride return with verified disposal.');
