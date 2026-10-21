import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertLocalApkBadging } from '../scripts/qa/local-apk-identity.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = name => read('android/app/src/main/java/be/sportgreenmoove/app/' + name);

test('component trial rejects non-isolated packages before test preparation with restoration still reachable', () => {
  for (const name of ['be.sportgreenmoove.app.local', 'be.sportgreenmoove.app.local.test']) {
    assertLocalApkBadging(`package: name='${name}' versionCode='1'\nsdkVersion:'26'`, name);
    assert.throws(() => assertLocalApkBadging("package: name='be.sportgreenmoove.app' versionCode='1'", name));
    assert.throws(() => assertLocalApkBadging("package: name='be.sportgreenmoove.app.test' versionCode='1'", name));
    assert.throws(() => assertLocalApkBadging('', name));
  }
  const runner = read('scripts/qa/run-team-chat-components.mjs');
  assert(runner.indexOf('try {\n  assertLocalApkIdentity(android') > 0);
  assert(runner.indexOf('assertLocalApkIdentity(android') < runner.indexOf('apkPreparation = prepareDisposableTestApks'));
  assert(runner.includes('restored = restoreContinuousDevice(device, setup)'));
  assert(runner.includes('apkPreparation.installationsRemainedBlocked, true'));
  assert(runner.includes('assertContinuousDevice(device, setup)'));
});

test('team directory is authenticated, bounded and evaluated through current authority', () => {
  const service = read('functions/src/services/teamConversationOptions.ts');
  for (const marker of ['requireTeamConversationAdult(transaction, uid, token)', 'membershipDocumentId(uid, clubId)',
    'timestampAtOrAfter(member.get("updatedAt"), club.createTime)', 'requireTeamConversationAccess(transaction, uid, token,',
    'input.kind, clubId, clubIdentity', 'query.limit(6)', 'error.code !== "permission-denied"']) assert(service.includes(marker), marker);
  assert(read('.github/workflows/web-integration-smoke.yml').includes('npm run test:team-chat-options'));
});
test('native access binds every callable to the current actor without direct document access', () => {
  const gateway = native('services/FirebaseAndroidTeamConversationGateway.kt');
  for (const name of ['listTeamChatOptions', 'getTeamChatMessages', 'sendTeamChatMessage']) assert(gateway.includes(name));
  assert(!gateway.includes('FirebaseFirestore')); assert(gateway.includes('auth.currentUser?.uid'));
  const wire = native('services/TeamConversationWire.kt');
  for (const marker of ['payload["currentUserId"] == uid', 'payload["teamInstanceId"] == target.teamInstanceId',
    'after-current-admission', 'payload["accessVersion"]', 'MembershipPageToken.decode']) assert(wire.includes(marker), marker);
});
test('background and failed authority hide private data; uncertain sends reuse the shared composer policy', () => {
  const route = native('ui/TeamConversationRoute.kt'), state = native('ui/TeamConversationState.kt');
  for (const marker of ['repeatOnLifecycle(Lifecycle.State.STARTED)', 'finally { state.clear() }',
    'if (state.error != null) awaitCancellation()', 'composer.sendOperation', 'TeamConversationDraftState(uid, target, storage)',
    'SharedPreferencesTeamConversationDrafts(context)']) assert(route.includes(marker), marker);
  for (const marker of ['if (version != page.accessVersion) { timeline = ConversationTimeline(); acknowledgedReads.clear()',
    'check(page.accessVersion == expectedVersion)', 'ticket != generation', 'messages = emptyList(); title = null']) assert(state.includes(marker), marker);
  const directory = native('ui/TeamConversationDirectory.kt');
  assert(directory.includes('finally { current.close() }')); assert(directory.includes('!page.hasMore'));
});
