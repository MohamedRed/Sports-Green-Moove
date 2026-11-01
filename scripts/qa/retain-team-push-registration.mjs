import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
const root=resolve(import.meta.dirname,'../..'),trial=process.argv[2];assert(isAbsolute(trial??''));
const report=JSON.parse(readFileSync(resolve(trial,'services-current-claims.json')));
assert.equal(report.completed,true);assert.equal(report.steps.length,19);assert.equal(report.isolatedEnvironmentDestroyed,true);
assert.equal(report.emulatorEndpoints.closed,true);assert.equal(report.pushDeliveryVerified,false);
const base=resolve(root,'docs/release/evidence/team-push-registration-recheck-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md'],'Never overwrite a retained trial');else mkdirSync(base);
const mapping={'services.json':'services-current-claims.json','functions.xml':'functions-current-claims.xml','rules.xml':'rules.xml',
  'failed-fixture-trial.txt':'final-trial.log','stale-claims-trial.txt':'stale-claims-negative.log'};
for(const [to,from]of Object.entries(mapping))copyFileSync(resolve(trial,from),resolve(base,to));
const parser=new XMLParser({ignoreAttributes:false});
for(const [file,expected]of [['functions.xml',571],['rules.xml',20]]){
  const xml=parser.parse(readFileSync(resolve(base,file))).testsuites;
  assert.equal(Number(xml['@_tests']),expected);assert.equal(Number(xml['@_failures']),0);assert.equal(Number(xml['@_errors']),0);
}
assert.match(readFileSync(resolve(base,'failed-fixture-trial.txt'),'utf8'),/1 !== 0/);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceFiles={...report.sourceFiles};
for(const file of ['functions/src/__tests__/team-push-registration.test.ts','functions/src/__tests__/team-conversation-accounts.test.ts','tests/notification-read-rules.test.ts',
  'tests/notification-inbox-contract.test.mjs','android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt'])
  sourceFiles[file]=sha(readFileSync(resolve(root,file)));
for(const [file,hash]of Object.entries(sourceFiles)){
  const bytes=readFileSync(resolve(root,file));assert.equal(sha(bytes),hash,'Tested source changed: '+file);
  const archive=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(archive))writeFileSync(archive,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(archive)),hash);
}
writeFileSync(resolve(base,'review.json'),JSON.stringify({scope:'server-registration-prerequisite-not-closed-app-delivery',
  testedAt:report.testedAt,runId:report.runId,checkpoints:19,unitTests:571,registrationUnitTests:15,rulesTests:20,
  currentClaimsRechecked:true,staleClaimTrialRetained:true,staleClaimTrialAccepted:false,
  failedFixtureTrialRetained:true,failedFixtureTrialAccepted:false,failedFixtureTrialSourceAttested:false,
  dispatcherImplemented:false,nativeLifecycleImplemented:false,realPhoneTokenRegistered:false,pushDeliveryVerified:false,
  physicalDevice:false,wholeHeadAttested:false,productionWrites:false,providerRequests:0,releaseAccepted:false,
  sourceFiles,publishedCaptures:{}},null,2)+'\n',{flag:'wx'});
const files=[...Object.keys(mapping),'review.json'];
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(files.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])),null,2)+'\n',{flag:'wx'});
console.log('Retained nineteen current-account checks, 571 unit cases and twenty rule/acknowledgement cases. No phone delivery claim.');
