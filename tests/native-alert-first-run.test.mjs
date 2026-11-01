import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {nativeAlertFirstRunFolder,validateNativeAlertFirstRun} from '../partner-portal/native-alert-first-run-validation.mjs';

test('first alert attempt retains failures, independent disposal and compiled-only candidate without rewriting phone history',()=>{
  const report=validateNativeAlertFirstRun(process.cwd());assert.equal(report.alertCases.passed,5);
  assert.equal(report.candidate.nativeUiCasesCompiled,12);
  const flow=content.flows.find(row=>row.id==='team-conversation');assert.equal(flow.status,'partial');
  assert.equal(flow.phone.checkedAt,'2026-10-21');
  assert.equal(flow.pushFirstNativeAttempt.source,nativeAlertFirstRunFolder+'review.json');
  const update=content.updates.find(row=>row.source===nativeAlertFirstRunFolder+'README.md');assert(update);
  assert.match(update.text,/restent à rejouer/);
  assert.doesNotMatch(update.text+update.title,/\b(?:firebase|browserstack|SDK|API|FCM|WorkManager|CI)\b/i);
});
for(const [file,key]of [['review.json','fullGatePassed'],['review.json','nativeNotificationPosted'],
  ['review.json','remoteForegroundReturnVerified'],['review.json','releaseAccepted'],
  ['main-review.json','fullGatePassed'],['main-review.json','releaseAccepted']])
  test(`rehashed first-run evidence cannot promote ${file} ${key}`,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-alert-first-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
    cpSync(nativeAlertFirstRunFolder,temp,{recursive:true});
    const path=resolve(temp,file),report=JSON.parse(readFileSync(path));report[key]=true;
    writeFileSync(path,JSON.stringify(report));
    const index=resolve(temp,'artifact-sha256.json'),hashes=JSON.parse(readFileSync(index));
    hashes[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(index,JSON.stringify(hashes));
    assert.throws(()=>validateNativeAlertFirstRun(process.cwd(),temp));
  });
test('corrected candidate preserves strict layout hosts, real lifecycle waits and selected navigation',()=>{
  const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const ui='android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
  const alerts=read(ui+'TeamPushOpenFlowTest.kt');
  assert(alerts.includes('V2ThemeToggleProvider(darkTheme = dark'));
  assert(alerts.includes('BottomNavMessagesAction).assertIsSelected()'));
  assert(alerts.includes('privateContentAbsent(); compose.onNodeWithTag(SgmTestTags.BottomNavHomeAction).assertIsSelected()'));
  const remote=read(ui+'LocalRemoteRideStopFlowTest.kt');assert(!remote.includes('activity.state'));
  assert(remote.includes('Stage.STOPPED'));assert(remote.includes('Stage.RESUMED'));
  assert(!read(ui+'ObservedActivityStage.kt').includes('catch'));
});
