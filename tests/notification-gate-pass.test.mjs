import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {parseDocument} from 'yaml';
import {notificationGateFolder as folder,validateNotificationGate} from '../scripts/qa/notification-gate-pass-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
test('source-specific full pass verifies actual notification cases and complete replay without release promotion',()=>{
  assert.equal(validateNotificationGate(process.cwd()).captureCorrectionVerifiedAtSource,true);
  const update=content.updates.find(row=>row.source===folder+'README.md');assert(update);
  assert.doesNotMatch(update.title+update.text,/BrowserStack|Firebase|SDK|APK|adbd|CI|Linux/);
  for(const id of ['messages','team-conversation','native-startup'])assert.equal(content.flows.find(row=>row.id===id).status,'partial');
  for(const id of ['native-evidence-copy','chat-send-stability'])assert.equal(content.blockers.find(row=>row.id===id).latestPassingSource,folder+'README.md');
});
for(const [file,mutate]of [
  ['review.json',row=>row.releaseAccepted=true],['review.json',row=>row.pushDeliveryVerified=true],
  ['review.json',row=>row.earlierTransportFailuresRepaired=true],['review.json',row=>row.wholeHeadAttested=true],
  ['native-run.json',row=>row.conclusion='failure'],['ordinary-results.json',row=>row.failed=1],
  ['replay/results.json',row=>row.nativeCaseCount=39],['native-suite-status.json',row=>row.ordinaryTests=1],
])test('full pass rejects rehashed '+file+' contradiction',t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-notification-gate-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  cpSync(resolve(folder),temp,{recursive:true});const path=resolve(temp,file),row=JSON.parse(readFileSync(path));mutate(row);writeFileSync(path,JSON.stringify(row));
  const manifestPath=resolve(temp,'artifact-sha256.json'),manifest=JSON.parse(readFileSync(manifestPath));
  manifest[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(manifestPath,JSON.stringify(manifest));
  assert.throws(()=>validateNotificationGate(process.cwd(),temp));
});
test('native and web gates retain the complete-pass contract alongside the original failure',()=>{
  for(const file of ['native-ci.yml','web-integration-smoke.yml']){
    const workflow=parseDocument(readFileSync('.github/workflows/'+file,'utf8')).toJSON();
    for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/notification-gate-pass.test.mjs'));
    const step=Object.values(workflow.jobs).flatMap(job=>job.steps??[]).find(step=>step.name==='Validate failed notification capture and unchanged quality gate');
    assert(step.run.includes('tests/alert-capture-failure.test.mjs'));assert(step.run.includes('tests/notification-gate-pass.test.mjs'));
  }
});
