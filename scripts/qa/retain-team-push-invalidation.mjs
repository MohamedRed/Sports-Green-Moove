import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,resolve} from 'node:path';
import {XMLParser,XMLBuilder} from 'fast-xml-parser';

const root=resolve(import.meta.dirname,'../..'),[services,units,firstLog,driftLog,firstSuite]=process.argv.slice(2);
for(const file of [services,units,firstLog,driftLog,firstSuite])assert(isAbsolute(file??''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=resolve(root,'docs/release/evidence/team-push-invalidation-2026-11-01');mkdirSync(base);
const hashes={},put=(file,bytes)=>{writeFileSync(resolve(base,file),bytes,{flag:'wx'});hashes[file]=sha(bytes);};
const archive=values=>Object.fromEntries(Object.entries(values).map(([file,bytes])=>{
  const hash=sha(bytes),path=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(path))writeFileSync(path,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(path)),hash);return[file,hash];
}));
const report=JSON.parse(readFileSync(services));assert.equal(report.completed,true);assert.equal(report.steps.length,22);
for(const [file,hash]of Object.entries(report.sourceFiles))assert.equal(sha(readFileSync(resolve(root,file))),hash,file);
archive(Object.fromEntries(Object.keys(report.sourceFiles).map(file=>[file,readFileSync(resolve(root,file))])));
put('services.json',readFileSync(services));
const all=new XMLParser({ignoreAttributes:false}).parse(readFileSync(units)).testsuites;
assert.equal(Number(all['@_tests']),623);assert.equal(Number(all['@_failures']),0);assert.equal(Number(all['@_errors']),0);
for(const [name,count]of [['team-push-invalidation',12],['team-push-dispatch',22]]){
  const suite=all.testsuite.find(row=>row['@_name']==='src/__tests__/'+name+'.test.ts');
  assert.equal(Number(suite['@_tests']),count);assert.equal(Number(suite['@_failures']),0);suite['@_hostname']='local-test-host';
  put(name+'-units.xml',new XMLBuilder({ignoreAttributes:false,format:true}).build({testsuite:suite}));
}
const clean=value=>value.split(homedir()).join('<home>');
const initial=clean(readFileSync(firstLog,'utf8'));assert.match(initial,/true !== false/);
assert.match(initial,/team-push-invalidation-checks.mjs:26:12/);
const excerpt=initial.slice(initial.indexOf('AssertionError'),initial.indexOf('Node.js',initial.indexOf('AssertionError')));
put('first-failure.txt',excerpt);
const drift=clean(readFileSync(driftLog,'utf8'));assert.match(drift,/Passed 22 durable dispatch cases/);
assert.match(drift,/strictly deep-equal/);put('source-drift-rejected.txt',drift.slice(drift.indexOf('Passed 22 durable dispatch cases')));
const prior='93d9138f71f9db4c315f6733448666d19e2e638b';
const initialSourceFiles=archive({
  'scripts/qa/local-team-push-dispatch-suite.mjs':readFileSync(firstSuite),
  'scripts/qa/team-push-invalidation-checks.mjs':readFileSync(resolve(root,'scripts/qa/team-push-invalidation-checks.mjs')),
  'functions/src/services/teamPushDispatchDelivery.ts':execFileSync('git',['show',prior+':functions/src/services/teamPushDispatchDelivery.ts'],{cwd:root}),
});
put('review.json',JSON.stringify({scope:'isolated-invalid-token-cleanup-not-provider-or-phone-proof',testedAt:report.testedAt,
  previousSourceCommit:prior,serviceCases:22,invalidationCases:8,unitTests:623,focusedUnitTests:12,
  defectReproduced:true,initialSourceFiles,intermediateSourceDriftRejected:true,
  providerRequests:0,productionDeployed:false,productionWrites:false,physicalDevice:false,
  pushDeliveryVerified:false,releaseAccepted:false,publishedCaptures:{}},null,2)+'\n');
for(const [file,hash]of Object.entries(hashes))assert.equal(sha(readFileSync(resolve(base,file))),hash);
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
console.log('Retained reproduced invalid-token defect, rejected source drift and 22 frozen-source service passes.');
