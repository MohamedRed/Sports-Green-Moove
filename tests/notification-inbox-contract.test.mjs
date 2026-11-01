import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('the dedicated notification-only reader is scoped to authenticated identity and current team authority',()=>{
  const api=read('functions/src/callables/notificationInbox.ts');
  for(const marker of ['requireAuth(request.auth?.uid)','z.object({}).strict()','userId: uid',
    'authorizedInboxNotifications(uid, request.auth?.token)'])assert(api.includes(marker),marker);
  assert(!api.includes('pendingReview'));assert(!api.includes('collection("messages")'));
  assert(read('functions/src/index.ts').includes('export { getNotificationInbox }'));
});
test('foreground notification polling is an independent primary transport with explicit error and lifecycle clearing',()=>{
  const state=read('android/app/src/main/java/be/sportgreenmoove/app/ui/NotificationInboxState.kt');
  for(const marker of ['gateway.loadNotificationInbox(uid)','ensureActive()','ticket != generation','delay(4_000)',
    'if (error != null) recovery.first { it > recoveryVersion }','if (recovered) recovery.value++',
    'finally { pause() }','items = emptyList()'])assert(state.includes(marker),marker);
  const inbox=read('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxState.kt');
  assert(inbox.includes('notificationInbox.observe()'));assert(inbox.includes('observeMetadata()'));
  assert(inbox.includes('inbox = value.copy(notifications = emptyList())'));
  const route=read('android/app/src/main/java/be/sportgreenmoove/app/ui/MessagesInboxRoute.kt');
  assert(route.includes('repeatOnLifecycle(Lifecycle.State.STARTED)'));
  assert(route.includes('notificationInboxItems(state.notificationInbox'));
  assert(route.includes('onRetry = { scope.launch { state.notificationInbox.refresh() } }'));
});
test('account-bound strict native parsing never substitutes an empty inbox for malformed or foreign data',()=>{
  const source=read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidNotificationInboxGateway.kt');
  assert.equal(source.split('auth.currentUser?.uid != uid').length-1,2);
  for(const marker of ['value["userId"] == uid','value.keys == setOf','rows.size <= 20','distinct().size == result.size'])
    assert(source.includes(marker),marker);
  assert(!source.includes('orEmpty()'));assert(!source.includes('return emptyList()'));
});
test('supported task snapshots are disabled before private content without changing foreground capture permission',()=>{
  const source=read('android/app/src/main/java/be/sportgreenmoove/app/MainActivity.kt');
  assert(source.includes('Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU'));
  assert(source.includes('setRecentsScreenshotEnabled(false)'));
  assert(source.indexOf('setRecentsScreenshotEnabled(false)')<source.indexOf('setContent {'));
  assert(!source.includes('FLAG_SECURE'),'Legacy screenshot policy still requires the product owner decision');
});
