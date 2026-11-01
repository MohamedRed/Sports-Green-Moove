import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {teamPushAlertSources} from './team-push-alert-sources.mjs';
import {teamPushAlertFolder,validateTeamPushAlertAuthorization} from '../../partner-portal/team-push-alert-validation.mjs';

const root=resolve(import.meta.dirname,'../..'),input=process.argv[2];
assert(isAbsolute(input??''),'Use a fresh isolated trial report');
const report=JSON.parse(readFileSync(input)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(report.completed,true);assert.equal(report.isolatedEnvironmentDestroyed,true);
assert.equal(report.pushDeliveryVerified,false);assert.equal(report.steps.length,16);
assert.deepEqual(Object.keys(report.sourceFiles).sort(),[...teamPushAlertSources].sort());
for(const [file,hash]of Object.entries(report.sourceFiles)){
  const bytes=readFileSync(resolve(root,file));assert.equal(sha(bytes),hash,'Tested source changed: '+file);
  const archive=resolve(root,'docs/release/evidence/source-archive',hash+'.txt');
  if(!existsSync(archive))writeFileSync(archive,bytes,{flag:'wx'});else assert.equal(sha(readFileSync(archive)),hash);
}
const base=resolve(root,teamPushAlertFolder);
if(existsSync(base))assert.deepEqual(readdirSync(base),['README.md'],'Never overwrite a retained trial');else mkdirSync(base);
copyFileSync(input,resolve(base,'services.json'));
writeFileSync(resolve(base,'artifact-sha256.json'),JSON.stringify({'services.json':sha(readFileSync(input))},null,2)+'\n',{flag:'wx'});
validateTeamPushAlertAuthorization(root);
console.log('Retained sixteen isolated alert-authority cases; native display, tap and delivery remain unverified.');
