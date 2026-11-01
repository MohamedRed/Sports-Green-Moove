import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {alertCaptureFailureFolder as folder,validateAlertCaptureFailure} from '../scripts/qa/alert-capture-failure-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

test('the complete failed source preserves one rejected notification image and a disconnected primary copy',()=>{
  const result=validateAlertCaptureFailure(process.cwd());assert.equal(result.repairVerified,false);
  assert.equal(result.notificationCasesPassed,3);assert.equal(result.releaseAccepted,false);
  const team=content.flows.find(row=>row.id==='team-conversation');assert.equal(team.status,'partial');
  assert.equal(team.checkedAt,'2026-11-01');assert.equal(team.phone.checkedAt,'2026-10-21');
  const note=content.updates.find(row=>row.source===folder+'README.md');assert(note);
  assert.doesNotMatch(note.title+note.text,/BrowserStack|Firebase|SDK|APK|adbd|CI|Linux/);
  assert.equal(content.blockers.find(row=>row.id==='native-evidence-copy').latestSource,folder+'README.md');
  assert.equal(content.blockers.find(row=>row.id==='chat-send-stability').latestSource,folder+'README.md');
  assert.equal(team.images.filter(row=>row.file.startsWith('team-alert-phone-')).length,4);
});
for(const [file,mutate]of [
  ['review.json',row=>row.rootCauseProven=true],['review.json',row=>row.repairVerified=true],
  ['review.json',row=>row.rejectedBitmapRetained=true],['review.json',row=>row.pushDeliveryVerified=true],
  ['review.json',row=>row.releaseAccepted=true],['review.json',row=>row.downloadedArchiveDigestIndependentlyVerified=true],
  ['native-run.json',row=>row.conclusion='success'],['ordinary-results.json',row=>row.failed=0],
  ['primary-copy.json',row=>row.completed=true],['sync-diagnostics.json',row=>row.observations=[]],
])test('rehashing a contradictory '+file+' cannot accept the failure as a repaired result',t=>{
  const temp=mkdtempSync(resolve(tmpdir(),'sgm-alert-capture-failure-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  cpSync(resolve(folder),temp,{recursive:true});const path=resolve(temp,file),value=JSON.parse(readFileSync(path));
  mutate(value);writeFileSync(path,JSON.stringify(value));
  const manifestPath=resolve(temp,'artifact-sha256.json'),manifest=JSON.parse(readFileSync(manifestPath));
  manifest[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(manifestPath,JSON.stringify(manifest));
  assert.throws(()=>validateAlertCaptureFailure(process.cwd(),temp));
});
test('both native and web gates validate the failed source and retain the unchanged capture threshold',()=>{
  for(const file of ['native-ci.yml','web-integration-smoke.yml']){
    const workflow=parseDocument(readFileSync(resolve('.github/workflows',file),'utf8')).toJSON();
    for(const event of ['push','pull_request'])assert(workflow.on[event].paths.includes('tests/alert-capture-failure.test.mjs'));
    assert(Object.values(workflow.jobs).some(job=>job.steps?.some(step=>step.run==='node --test tests/alert-capture-failure.test.mjs')));
  }
  const capture=readFileSync('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalUiCapture.kt','utf8');
  assert(capture.includes('check(colors.size > 16)'));assert.equal(capture.match(/captureToImage\(/g).length,1);
  const testSource=readFileSync('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NotificationInboxFlowTest.kt','utf8');
  assert(testSource.includes('onRetry={scope.launch { state.refresh() }}'));
  assert(testSource.includes('waitFor("notification.teamChat_after_retry")'));
  assert(!testSource.includes('LaunchedEffect(state,retry)'));
});
