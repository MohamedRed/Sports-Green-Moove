import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {withDisposableNotificationPermission} from '../scripts/qa/disposable-notification-permission.mjs';
import {nativeTeamAlertFolder,validateNativeTeamAlertConsumer} from '../partner-portal/team-push-native-consumer-validation.mjs';
import {content} from '../partner-portal/content.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const services='android/app/src/main/java/be/sportgreenmoove/app/services/';
test('opaque data messages use durable Android work rather than an unowned background coroutine or tray payload',()=>{
  assert(read(services+'TeamPushMessagingService.kt').includes('if (message.notification == null) AndroidTeamPushRuntime.received'));
  const runtime=read(services+'AndroidTeamPushRuntime.kt');
  assert(runtime.includes('data.keys != setOf("type", "notificationId")'));
  assert(runtime.includes('lifecycle.acceptsAlert(request)'));assert(runtime.includes('lifecycle.synchronize(teamNotificationsAllowed(context))'));
  assert(runtime.includes('lifecycle.resolveAlert(request, purpose, alerts::resolve)'));
  assert(runtime.includes('lifecycle.prepareSignOut(::clearAlerts)'));
  const worker=read(services+'TeamPushDeliveryWorker.kt');
  assert(worker.includes('CoroutineWorker(context, parameters)'));assert(worker.includes('ExistingWorkPolicy.KEEP'));
  assert(worker.includes('withTimeout(25_000L)'));assert(!worker.includes('Result.retry()'));
  assert(!worker.includes('installationSecret'));assert(!worker.includes('token'));
  const gradle=read('android/app/build.gradle.kts');assert(gradle.includes('androidx.work:work-runtime-ktx:2.10.5'));
});
test('every display and tap rechecks current account epoch and server authority without implicit message reads',()=>{
  const lifecycle=read(services+'TeamPushLifecycle.kt');
  for(const marker of ['record.epoch == request.epoch','journal.confirmedFor(request.uid)',
    'journal.current().revision != lease.revision','consume(target)','afterIntent()'])assert(lifecycle.includes(marker),marker);
  const gateway=read(services+'FirebaseAndroidTeamPushAlert.kt');
  assert(gateway.includes('getHttpsCallable("resolveTeamPushAlert")'));
  assert.equal((gateway.match(/auth.currentUser\?\.uid != lease.uid/g)??[]).length,2);
  assert(!gateway.includes('markNotificationRead'));assert(!gateway.includes('markRead'));
  const notification=read(services+'AndroidTeamPushNotification.kt');
  for(const marker of ['PendingIntent.FLAG_IMMUTABLE','Intent(context, MainActivity::class.java)',
    'setContentTitle(teamPushAlertTitle).setContentText(teamPushAlertBody)',
    'startsWith(teamPushNotificationPrefix)','Notification.VISIBILITY_PRIVATE'])assert(notification.includes(marker),marker);
  assert(!notification.includes('putExtra("target"'));assert(!notification.includes('putExtra("body"'));
});
test('actual root navigation remains behind the authentication gate and preserves test-provider injection',()=>{
  const root=read('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt');
  assert(root.indexOf('AppAccessGate(')<root.indexOf('if (teamAlertRequest != null) TeamPushOpenRoute'));
  assert(root.includes('providerFactory: (Context) -> AndroidProviderSet = AndroidRuntime::create)'));
  assert(root.includes('onTeamAlertConsumed(); screen = destination'));
  const main=read('android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt');
  assert(main.includes('override fun onNewIntent(intent: Intent)'));assert(main.includes('teamAlert = teamPushOpenRequest(intent)'));
  assert(main.includes('onTeamAlertConsumed = ::consumeTeamAlert'));assert(!main.includes('FLAG_SECURE'));
  assert(main.includes('teamAlertAttempt++'));assert(root.includes('attempt = teamAlertAttempt'));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/TeamPushOpenRoute.kt')
    .includes('remember(request, uid, adult, alerts, attempt, refresh)'));
});
test('the existing focused device runs both old suites then the new route and platform cases with separate restoration evidence',()=>{
  const runner=read('scripts/qa/run-local-team-read-components-ui.mjs');
  assert(runner.indexOf('run-team-chat-components.mjs')<runner.indexOf('run-session-shutdown-components.mjs'));
  assert(runner.indexOf('run-session-shutdown-components.mjs')<runner.indexOf('run-team-alert-components.mjs'));
  const extra=read('scripts/qa/run-team-alert-components.mjs');
  assert(extra.includes('Focused alert cases cannot be skipped or failed'));
  for(const marker of ["TeamPushOpenFlowTest',8","TeamPushPlatformFlowTest',4",'notification-permission-restoration.json',
    'assert.deepEqual(snapshot(),sourceFiles)','pushDeliveryVerified:false','nativeNotificationTapVerified:false','realMessagingSdkCalls:0'])
    assert(extra.includes(marker),marker);
  const workflow=parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  assert(workflow.jobs['people-safety'].steps.find(row=>row.name==='Test current-device team alert resolution')
    .run.includes('tests/team-push-native-consumer.test.mjs'));
});
function device(original=false,{unreadable=false,wrong=false,restoreFails=false}={}){
  let granted=original;const calls=[];
  return{serial:wrong?'personal-device':'emulator-5554',calls,shell(...args){
    calls.push(args);if(args[0]==='getprop')return args[1]==='ro.kernel.qemu'?'1':'35';
    if(args[0]==='am')return'0';
    if(args[0]==='dumpsys')return unreadable?'unreadable':`    android.permission.POST_NOTIFICATIONS: granted=${granted}, flags=[]`;
    if(args[0]==='pm'){if(args[1]==='revoke'&&restoreFails)throw Error('Synthetic restore failure');granted=args[1]==='grant';return'';}
    assert.fail('Unexpected device command');
  }};
}
test('disposable notification permission is restored after a successful or failed native action',()=>{
  for(const fail of [false,true]){
    const phone=device(),error=Error('Synthetic test failure');
    const result=withDisposableNotificationPermission(phone,()=>{if(fail)throw error;return'actual-result';});
    assert.equal(result.receipt.restored,true);assert.equal(result.receipt.originallyGranted,false);
    assert.equal(result.receipt.completed,!fail);assert.equal(result.failure,fail?error:undefined);
    assert.deepEqual(phone.calls.filter(args=>args[0]==='pm').map(args=>args[1]),['grant','revoke']);
  }
});
test('existing permission is preserved and unreadable or personal devices are never modified',()=>{
  const phone=device(true);assert.equal(withDisposableNotificationPermission(phone,()=>{}).receipt.restored,true);
  assert(!phone.calls.some(args=>args[0]==='pm'));
  for(const phone of [device(false,{unreadable:true}),device(false,{wrong:true})]){
    assert.throws(()=>withDisposableNotificationPermission(phone,()=>assert.fail('Must not execute')));
    assert(!phone.calls.some(args=>args[0]==='pm'));
  }
});
test('failed restoration is explicitly failed rather than reported as successful cleanup',()=>{
  const result=withDisposableNotificationPermission(device(false,{restoreFails:true}),()=>{});
  assert(result.failure);assert.equal(result.receipt.restored,false);assert.equal(result.receipt.completed,false);
});
test('the local build proves twenty model cases and eleven compiled native cases, not an executed notification or tap',()=>{
  const result=validateNativeTeamAlertConsumer(process.cwd());assert.equal(result.focusedUnitTests,20);
  const flow=content.flows.find(row=>row.id==='team-conversation');assert.equal(flow.status,'partial');
  assert.equal(flow.pushNativeConsumer.source,nativeTeamAlertFolder+'review.json');
  assert.equal(flow.phone.checkedAt,'2026-10-21');assert.equal(flow.latestEvidence,'phone');
  const update=content.updates.find(row=>row.source===nativeTeamAlertFolder+'README.md');assert(update);
  assert.match(update.text,/locaux/);assert.match(update.text,/reste à vérifier sur téléphone/);
  assert.doesNotMatch(update.text+update.title,/\b(?:firebase|browserstack|SDK|API|FCM|WorkManager|CI)\b/i);
  const release=JSON.parse(read('docs/release/evidence-manifest.json'));
  for(const item of release.operationalUserFlowEvidence.items.filter(row=>row.id.startsWith('team_push_')))assert.equal(item.status,'pending');
});
for(const key of ['instrumentationExecuted','nativeUiCasesExecuted','workerExecuted','nativeNotificationPosted',
  'nativeNotificationTapVerified','physicalDevice','realPhoneTokenRegistered','pushDeliveryVerified','releaseAccepted'])
  test(`rehashed compilation evidence cannot promote ${key}`,t=>{
    const temp=mkdtempSync(resolve(tmpdir(),'sgm-native-alert-evidence-'));
    t.after(()=>rmSync(temp,{recursive:true,force:true}));cpSync(nativeTeamAlertFolder,temp,{recursive:true});
    const file=resolve(temp,'review.json'),run=JSON.parse(readFileSync(file));run[key]=true;
    writeFileSync(file,JSON.stringify(run));const index=resolve(temp,'artifact-sha256.json'),hashes=JSON.parse(readFileSync(index));
    hashes['review.json']=createHash('sha256').update(readFileSync(file)).digest('hex');writeFileSync(index,JSON.stringify(hashes));
    assert.throws(()=>validateNativeTeamAlertConsumer(process.cwd(),temp));
  });
