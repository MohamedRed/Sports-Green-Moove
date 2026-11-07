import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,copyFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {validateTeamAlertRun,teamAlertEvidence} from './team-alert-evidence.mjs';

const root=resolve(import.meta.dirname,'../..'),trial=process.argv[2];
assert(trial&&trial.startsWith('/private/tmp/sgm-team-alerts-'));
const destination=dirname(resolve(root,teamAlertEvidence));mkdirSync(destination,{recursive:true});
const name=process.argv[3]??'services-final.json';assert(/^services[-a-z]*\.json$/.test(name));
const source=resolve(trial,name),run=validateTeamAlertRun(JSON.parse(readFileSync(source)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prior=resolve(destination,'services.json');
if(existsSync(prior)&&sha(readFileSync(prior))!==sha(readFileSync(source))) {
  const historical=resolve(destination,'previous-services-'+sha(readFileSync(prior))+'.json');
  if(!existsSync(historical))copyFileSync(prior,historical);
}
copyFileSync(source,resolve(destination,'services.json'));
for(const [path,expected]of Object.entries(run.sourceFiles)) {
  const bytes=readFileSync(resolve(root,path));assert.equal(sha(bytes),expected,path);
  const archive=resolve(root,'docs/release/evidence/source-archive',expected+'.txt');
  if(!existsSync(archive))writeFileSync(archive,bytes,{flag:'wx'});
}
const failures=[];
for(const name of ['services.log','services-third.log']) {
  const bytes=readFileSync(resolve(trial,name)),text=bytes.toString('utf8');
  const start=text.indexOf('AssertionError [ERR_ASSERTION]:'),end=text.indexOf('\nNode.js ',start);
  assert(start>=0&&end>start);
  const excerpt=text.slice(start,end)+'\n',file=name.replace('.log','-failure.txt');
  assert(!/Bearer |eyJ[A-Za-z0-9_-]{30}|access_token|refresh_token|password\s*[:=]/i.test(excerpt));
  if(existsSync(resolve(destination,file)))assert.equal(sha(readFileSync(resolve(destination,file))),sha(excerpt));
  else writeFileSync(resolve(destination,file),excerpt,{flag:'wx'});
  failures.push({original:name,originalSha256:sha(bytes),retainedExcerpt:file,excerptSha256:sha(excerpt),
    sourceSnapshotRetained:false,scope:'test-harness-assertion-failure-not-an-application-regression'});
}
writeFileSync(resolve(destination,'earlier-failures.json'),JSON.stringify(failures,null,2)+'\n');
const regression=readFileSync(resolve(trial,'notification-rules.log'));
assert(regression.includes("Can't determine Firebase Database URL."));
assert(!/Bearer |eyJ[A-Za-z0-9_-]{30}|access_token|refresh_token|password\s*[:=]/i.test(regression.toString()));
copyFileSync(resolve(trial,'notification-rules.log'),resolve(destination,'notification-read-import-failure.txt'));
const files=readdirSync(destination).filter(name=>name!=='artifact-sha256.json');
writeFileSync(resolve(destination,'artifact-sha256.json'),JSON.stringify(Object.fromEntries(files.map(name=>
  [name,sha(readFileSync(resolve(destination,name)))])),null,2)+'\n');
console.log('Retained local team alert proof, source snapshots and two earlier harness failure excerpts.');
