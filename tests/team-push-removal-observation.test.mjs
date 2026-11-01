import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {toolchainNotificationFolder,validateToolchainNotificationRecheck} from '../partner-portal/toolchain-notification-validation.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('the native test observes asynchronous acknowledgement without repeating a notification operation or changing production code',()=>{
  const source=read('android/app/src/androidTest/java/be/sportgreenmoove/app/services/TeamPushPlatformFlowTest.kt');
  assert.equal((source.match(/@Test fun /g)??[]).length,4);
  assert(source.includes('val deadline = SystemClock.uptimeMillis() + 5_000'));
  assert(source.includes('val snapshot = manager.activeNotifications.toList()'));
  assert(source.includes('SystemClock.sleep(25)'));assert(source.includes('throw AssertionError("Notification service did not acknowledge $phase")'));
  const observer=source.slice(source.indexOf('private fun awaitNotifications'),source.indexOf('private fun worker'));
  assert(!observer.includes('postTeamPushNotification'));assert(!observer.includes('clearTeamPushNotifications'));assert(!observer.includes('catch'));
  assert(source.includes('rows.count { it.tag == teamPushWorkName(request) } == 1 && rows.any { it.tag == control }'));
  assert(source.includes('rows.none { it.tag?.startsWith(teamPushNotificationPrefix) == true } && rows.any { it.tag == control }'));
  for(const value of ['notification.contentIntent.isImmutable','Notification.VISIBILITY_PRIVATE','assertEquals(teamPushAlertTitle',
    'assertEquals(teamPushAlertBody'])assert(source.includes(value),value);
  assert.equal((source.match(/postTeamPushNotification\(context, request\)/g)??[]).length,2);
  const report=validateToolchainNotificationRecheck(process.cwd());
  const production='android/app/src/main/java/be/sportgreenmoove/app/services/AndroidTeamPushNotification.kt';
  assert.equal(report.candidate.sourceFiles[production],report.nativeFailure.sourceFiles[production]);
});
test('both passing comparisons preserve the old failure and do not select a product toolchain or accept a full gate',()=>{
  const report=validateToolchainNotificationRecheck(process.cwd());assert.equal(report.transferPassesPerComparison,32);
  assert.equal(report.versionCauseConfirmed,false);assert.equal(report.candidate.instrumentationExecuted,false);
  const flow=content.flows.find(row=>row.id==='team-conversation');assert.equal(flow.status,'partial');
  assert.equal(flow.pushRemovalObservation.source,toolchainNotificationFolder+'review.json');assert.equal(flow.phone.checkedAt,'2026-10-21');
  const update=content.updates.find(row=>row.source===toolchainNotificationFolder+'README.md');assert(update);
  assert.doesNotMatch(update.title+update.text,/\b(?:firebase|browserstack|SDK|API|FCM|CI|provider)\b/i);
});
for(const [file,key,value]of [['review.json','versionCauseConfirmed',true],['review.json','defaultProductToolchainChanged',true],
  ['review.json','wholeGatePassed',true],['review.json','pushDeliveryVerified',true],['review.json','releaseAccepted',true],
  ['failed-result.json','success',true],['pinned-result.json','retryPerformed',true]])
  test('rehashed comparison/notification evidence cannot promote '+file+' '+key,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-removal-observation-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
    cpSync(toolchainNotificationFolder,temp,{recursive:true});const path=resolve(temp,file),row=JSON.parse(readFileSync(path));
    row[key]=value;writeFileSync(path,JSON.stringify(row));const index=resolve(temp,'artifact-sha256.json'),hashes=JSON.parse(readFileSync(index));
    hashes[file]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(index,JSON.stringify(hashes));
    assert.throws(()=>validateToolchainNotificationRecheck(process.cwd(),temp));
  });
