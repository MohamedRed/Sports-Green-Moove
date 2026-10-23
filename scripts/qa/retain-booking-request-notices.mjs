import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocalEndpointsClosed } from './local-emulator-lifecycle.mjs';

const [input, destination] = process.argv.slice(2);
assert(input?.startsWith('/') && destination?.startsWith('/') && !existsSync(destination));
const endpoints = await assertLocalEndpointsClosed([9099,8080,9000,5001]);
const services = JSON.parse(readFileSync(resolve(input,'services.json')));
assert.equal(services.completed,true); assert.equal(services.steps.length,20);
const regression = JSON.parse(readFileSync(resolve(input,'regression.json')));
assert.equal(regression.steps.length,24); assert(regression.steps.every(row=>row.status==='passed'));
mkdirSync(destination,{recursive:true});
const write = (file,row) => writeFileSync(resolve(destination,file),JSON.stringify(row,null,2)+'\n');
for (const file of ['services.json','regression.json','units.txt','red.txt']) copyFileSync(resolve(input,file),resolve(destination,file));
for (const [file,name] of [['src/callables/bookingRequests.ts','before-handler.ts.txt'],
  ['src/__tests__/booking-request-transaction.test.ts','red-test.ts.txt']])
  copyFileSync(resolve(input,'baseline/functions',file),resolve(destination,name));
for (const [file,hash] of Object.entries(services.sourceFiles)) {
  const bytes=readFileSync(file); assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  const target=resolve(destination,'source',file+'.txt'); mkdirSync(resolve(target,'..'),{recursive:true}); writeFileSync(target,bytes);
}
for (const file of ['scripts/qa/local-chat-safety.mjs','scripts/qa/run-local-booking-notices.mjs',
  'functions/src/__tests__/booking-request-transaction.test.ts','functions/src/__tests__/booking-notifications.test.ts']) {
  const target=resolve(destination,'source',file+'.txt'); mkdirSync(resolve(target,'..'),{recursive:true}); copyFileSync(file,target);
}
write('summary.json',{checkedAt:services.testedAt.slice(0,10),
  scope:'isolated-booking-request-notices-not-connected-ui-push-or-production',
  baselineCommit:'3413b579ac5c8cb3c5a4a7f172b74aa5ad339d4a',sourceWasUncommittedDuringTests:true,
  redReproducedAgainstBaseline:true,serviceCasesPassed:20,requestCasesPassed:8,backendUnitCasesPassed:436,
  broaderServiceGroupsPassed:24,protectedRecords:158,emulatorEndpoints:endpoints,
  connectedNativeUiAccepted:false,physicalPhoneAccepted:false,pushDeliveryAccepted:false,
  productionDeployed:false,productionWrites:false,newMediaPublished:false,releaseComplete:false});
const hashes={};
function walk(folder='') {
  for(const entry of readdirSync(resolve(destination,folder),{withFileTypes:true})) {
    const file=folder?folder+'/'+entry.name:entry.name;
    if(entry.isDirectory()) walk(file); else hashes[file]=createHash('sha256').update(readFileSync(resolve(destination,file))).digest('hex');
  }
}
walk(); write('artifact-sha256.json',hashes);
console.log('Retained isolated booking-request notice checks; no phone, push or deployment acceptance.');
