import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),trial=process.argv[2];assert(isAbsolute(trial??''));
const base=resolve(root,'docs/release/evidence/team-current-account-regressions-2026-11-01');
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md']);else mkdirSync(base);
const names=['conversation','directory','reads','alerts','inbox'],counts=[18,6,12,11,7],sourceFiles={};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),runs=[];
for(const [index,name]of names.entries()){
  const file=name+'.json',bytes=readFileSync(resolve(trial,file)),row=JSON.parse(bytes);
  assert.equal(row.steps.length,counts[index]);assert(row.steps.every(step=>step.status==='passed'));
  assert.equal(row.isolatedEnvironmentDestroyed,true);assert.equal(row.emulatorEndpoints.closed,true);assert.equal(row.adminClientClosed,true);
  assert.equal(row.physicalDevice,false);assert.equal(row.nativeUiExecuted,false);assert.equal(row.productionWrites,false);
  for(const [path,hash]of Object.entries(row.sourceFiles)){if(sourceFiles[path])assert.equal(sourceFiles[path],hash);sourceFiles[path]=hash;}
  copyFileSync(resolve(trial,file),resolve(base,file));runs.push({name,runId:row.runId,testedAt:row.testedAt,steps:counts[index]});
}
for(const file of ['functions/src/services/teamConversationAccounts.ts','functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamNotificationAccess.ts','functions/src/services/teamConversationAlerts.ts','functions/src/services/teamConversationOptions.ts'])
  sourceFiles[file]=sha(readFileSync(resolve(root,file)));
for(const [path,hash]of Object.entries(sourceFiles)){
  const bytes=readFileSync(resolve(root,path));assert.equal(sha(bytes),hash,path);
  const archive=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(archive))writeFileSync(archive,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(archive)),hash);
}
writeFileSync(resolve(base,'review.json'),JSON.stringify({scope:'five-team-service-regressions-after-current-account-guard-not-phone-or-release',
  testedAt:runs.at(-1).testedAt,runs,flowCount:5,serviceCases:54,sourceFiles,legacySourcePrePostBound:false,
  individualFirestoreClientTerminationIndependentlyRecordedForFirstThree:false,
  physicalDevice:false,nativeUiExecuted:false,pushDeliveryVerified:false,productionWrites:false,releaseAccepted:false,
  wholeHeadAttested:false,providerRequests:0,publishedCaptures:{}},null,2)+'\n',{flag:'wx'});
const files=[...names.map(name=>name+'.json'),'review.json'];
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(files.sort().map(file=>[file,sha(readFileSync(resolve(base,file)))])),null,2)+'\n',{flag:'wx'});
console.log('Retained 54 team service regression cases across five independently disposed runtimes.');
