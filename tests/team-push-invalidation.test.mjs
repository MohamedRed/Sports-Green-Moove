import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';
import {validatePushCleanup,validateReturnPass,pushCleanupFolder,returnPassFolder} from '../partner-portal/push-cleanup-and-return-validation.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('invalid registration cleanup preserves exact binding and reverse ownership after the lease check',()=>{
  const delivery=read('functions/src/services/teamPushDispatchDelivery.ts');
  assert(delivery.indexOf('row.leaseId!==leaseId')<delivery.indexOf('await retireRejectedTeamPushBinding'));
  assert(delivery.includes('if(result.reason==="invalid_token")await retireRejectedTeamPushBinding'));
  const cleanup=read('functions/src/services/teamPushInvalidation.ts');
  for(const value of ['device.userId!==binding.userId','device.revision!==binding.revision',
    'device.fingerprint!==binding.fingerprint','device.token!==token','reverse.installationId!==binding.installationId',
    'reverse.userId!==binding.userId','reverse.revision!==binding.revision'])assert(cleanup.includes(value),value);
  assert(cleanup.indexOf('await transaction.getAll')<cleanup.indexOf('transaction.update'));
  assert(cleanup.includes('transaction.delete(tokenRef)'));assert(!cleanup.includes('revision:device.revision+1'));
  assert(!cleanup.includes('console.'));assert(!cleanup.includes('catch'));
});
test('the reproduced defect and frozen-source race checks remain isolated from real notification delivery',()=>{
  const review=validatePushCleanup(process.cwd());assert.equal(review.invalidationCases,8);
  const flow=content.flows.find(row=>row.id==='team-conversation');assert.equal(flow.status,'partial');
  assert.equal(flow.pushInvalidation.source,pushCleanupFolder+'review.json');assert.equal(flow.phone.checkedAt,'2026-10-21');
  const release=JSON.parse(read('docs/release/evidence-manifest.json'));
  for(const row of release.operationalUserFlowEvidence.items.filter(row=>row.id.startsWith('team_push_')))assert.equal(row.status,'pending');
});
test('the foreground recheck preserves prior failure and proves the focused lane only',()=>{
  const review=validateReturnPass(process.cwd());assert.equal(review.frameworkCases,2);
  const flow=content.flows.find(row=>row.id==='native-startup');assert.equal(flow.status,'partial');assert.equal(flow.checkedAt,'2026-10-19');
  assert(flow.foregroundReturnIntent);assert.equal(flow.foregroundReturnPass.source,returnPassFolder+'review.json');
  for(const folder of [pushCleanupFolder,returnPassFolder]){
    const update=content.updates.find(row=>row.source===folder+'README.md');assert(update);
    assert.doesNotMatch(update.title+update.text,/\b(?:firebase|browserstack|SDK|API|FCM|CI|provider)\b/i);
  }
  const {recent,previous}=partitionUpdates(content.updates);
  assert(recent.some(row=>row.source===returnPassFolder+'README.md'));
  const old='docs/release/evidence/foreground-return-intent-b9a9000-2026-11-01/README.md';
  assert(!recent.some(row=>row.source===old));assert(previous.some(row=>row.source===old));
});
for(const [folder,validate,file,key,value]of [
  [pushCleanupFolder,validatePushCleanup,'review.json','pushDeliveryVerified',true],
  [pushCleanupFolder,validatePushCleanup,'review.json','releaseAccepted',true],
  [pushCleanupFolder,validatePushCleanup,'services.json','providerRequests',1],
  [pushCleanupFolder,validatePushCleanup,'services.json','isolatedEnvironmentDestroyed',false],
  [returnPassFolder,validateReturnPass,'review.json','wholeGatePassed',true],
  [returnPassFolder,validateReturnPass,'review.json','physicalDevice',true],
  [returnPassFolder,validateReturnPass,'remote-ride-stop-results.json','productionWrites',true],
])test('rehashed cleanup/return evidence cannot promote '+folder+file+' '+key,t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-cleanup-return-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  cpSync(folder,temp,{recursive:true});const path=resolve(temp,file),record=JSON.parse(readFileSync(path));
  record[key]=value;writeFileSync(path,JSON.stringify(record));const index=resolve(temp,'artifact-sha256.json');
  const hashes=JSON.parse(readFileSync(index));hashes[file]=createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(index,JSON.stringify(hashes));assert.throws(()=>validate(process.cwd(),temp));
});
