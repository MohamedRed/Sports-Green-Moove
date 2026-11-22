import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { teamChatNativeChecks, teamChatNativeScope, validateTeamChatNativeDevice } from '../scripts/qa/team-chat-native-evidence.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const bytes = Buffer.from('schema-validator-fixture-not-device-evidence'), hash = createHash('sha256').update(bytes).digest('hex');
function fixture() {
  return { scope: teamChatNativeScope, projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), peerMessageId: 'b'.repeat(64),
    parentMessageId: 'c'.repeat(64), guardianRevokeRequestId: '12345678-1234-4234-8234-123456789abc',
    checks: teamChatNativeChecks.map(id => ({ id, status: 'passed' })),
    screenshots: Object.fromEntries(['parent', 'exchange', 'draft', 'revoked', 'driver'].flatMap(stem =>
      ['.png', '-window.png'].map(suffix => ['team-chat-native-' + stem + suffix, hash]))) };
}
const receipt = { phase: 'team-conversation', completed: true, runId: 'a'.repeat(32) };
test('connected marker requires its exact nine checks, owned transfer and ten byte-matching captures', () => {
  validateTeamChatNativeDevice(fixture(), receipt, 'a'.repeat(32), () => bytes);
  for (const mutate of [value => value.checks.pop(), value => value.checks[0].status = 'failed',
    value => value.scope = 'physical-device', value => value.runId = 'd'.repeat(32),
    value => value.parentMessageId = value.peerMessageId, value => delete value.screenshots['team-chat-native-driver.png']]) {
    const report = fixture(); mutate(report);
    assert.throws(() => validateTeamChatNativeDevice(report, receipt, 'a'.repeat(32), () => bytes));
  }
  assert.throws(() => validateTeamChatNativeDevice(fixture(), { ...receipt, completed: false }, 'a'.repeat(32), () => bytes));
  assert.throws(() => validateTeamChatNativeDevice(fixture(), receipt, 'a'.repeat(32), () => Buffer.from('wrong bytes')));
});
test('connected app case uses actual auth and SDK peers rather than a component gateway', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamConversationFlowTest.kt');
  for (const marker of ['ActivityScenario.launch(MainActivity::class.java)', 'activity.recreate()',
    'activity.moveToState(Lifecycle.State.CREATED)', 'manager.revokeParent()', 'driver.observeParentMessage',
    'driver.send(', 'login(session, "driver")', 'assertEquals("", inputText())']) assert(native.includes(marker), marker);
  assert(!native.includes('TeamChatUiFixture')); assert(!native.includes('setSgmUiTestContent'));
  const activity = native.indexOf('ActivityScenario.launch(MainActivity::class.java)');
  assert(native.indexOf('LocalTeamChatPeer.open(context, session, "driver")') < activity);
  assert(native.indexOf('LocalTeamChatPeer.open(context, session, "manager")') < activity);
  const peer = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamChatPeer.kt');
  for (const marker of ['FirebaseAndroidTeamConversationGateway(functions, auth)', 'auth.useEmulator', 'functions.useEmulator',
    'FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent"', 'auth.signOut(); app.delete()']) assert(peer.includes(marker), marker);
  const script = read('scripts/qa/local-team-conversation-ui.mjs');
  assert(script.indexOf('assertInstrumentationPassed(transcript, 1)') < script.indexOf('isolation = await verifyTeamChatNativeRecords'));
  for (const marker of ['await deleteApp(getApp())', 'resetDisposableLocalApps(adb, serial)', 'notificationsVerified: false',
    'physicalDevice: false', 'fullProcessRestartProven: false', '.replaceAll(process.env.SGM_QA_PASSWORD, \'[REDACTED]\')'])
    assert(script.includes(marker), marker);
  const records = read('scripts/qa/team-chat-native-records.mjs');
  for (const marker of ["'guardianVerificationEvents'", "assert.equal(entries.size, 5)", 'verifyTeamChatProtectedBaseline(fixture)',
    "await denied('getTeamChatMessages', fixture.parent", 'fixture.otherParent', "row.get('clientMessageId')"]) assert(records.includes(marker), marker);
});
