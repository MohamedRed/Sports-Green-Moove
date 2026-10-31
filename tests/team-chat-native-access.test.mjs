import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { teamAccessNativeScope, teamAccessNativeChecks, validateTeamAccessNativeDevice } from '../scripts/qa/team-access-native-evidence.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const bytes = Buffer.from('contract-fixture-not-executed-device-proof'), hash = createHash('sha256').update(bytes).digest('hex');
const receipt = { phase: 'team-access', runId: 'a'.repeat(32), completed: true };
function fixture() {
  return { projectId: 'demo-sgm-local-qa', runId: receipt.runId, scope: teamAccessNativeScope,
    checks: teamAccessNativeChecks.map(id => ({ id, status: 'passed' })),
    events: Object.fromEntries(['secondChildApproval', 'firstRevocation', 'secondRevocation', 'renewal', 'otherTeamApproval']
      .map((id, index) => [id, `${index}2345678-1234-4234-8234-123456789abc`])),
    messages: Object.fromEntries(['afterSecond', 'afterRenewal', 'otherIncoming', 'otherReply'].map((id, index) => [id, String(index).repeat(64)])),
    screenshots: Object.fromEntries(['initial', 'remaining', 'revoked', 'renewed', 'other', 'isolated'].flatMap(id =>
      ['.png', '-window.png'].map(suffix => ['team-access-' + id + suffix, hash]))) };
}
test('native access marker requires eleven checks, twelve captures, four messages and five manager operations', () => {
  validateTeamAccessNativeDevice(fixture(), receipt, receipt.runId, () => bytes);
  for (const mutate of [x => x.checks.pop(), x => x.checks[0].status = 'failed', x => x.scope = 'phone',
    x => delete x.screenshots['team-access-other-window.png'], x => x.messages.otherReply = x.messages.otherIncoming,
    x => x.events.renewal = x.events.firstRevocation]) {
    const value = fixture(); mutate(value); assert.throws(() => validateTeamAccessNativeDevice(value, receipt, receipt.runId, () => bytes));
  }
  assert.throws(() => validateTeamAccessNativeDevice(fixture(), { ...receipt, completed: false }, receipt.runId, () => bytes));
  assert.throws(() => validateTeamAccessNativeDevice(fixture(), receipt, receipt.runId, () => Buffer.from('wrong')));
});
test('actual parent UI observes foreground grant changes, isolated teams and independently read reply', () => {
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamAccessFlowTest.kt');
  for (const marker of ['ActivityScenario.launch(MainActivity::class.java)', 'manager.approveChild(', 'manager.revokeParent(',
    'manager.renewParent(', 'ui.send("Réponse seconde équipe QA")', 'driver.observeParentMessage(',
    'ui.absent("Bonjour équipe QA")', 'ui.openTeam(other.teamId)', 'assertEquals("", ui.inputText())']) assert(native.includes(marker), marker);
  assert(!native.includes('setSgmUiTestContent')); assert(!native.includes('TeamChatUiFixture'));
  const activity = native.indexOf('ActivityScenario.launch(MainActivity::class.java)');
  for (const role of ['driver', 'manager']) assert(native.indexOf(`LocalTeamChatPeer.open(context, session, "${role}")`) < activity);
  const peer = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTeamChatPeer.kt');
  assert(peer.includes('FirebaseAuth.getInstance().currentUser?.uid == "sgm-qa-parent"'));
  assert(peer.includes('FirebaseFunctions.getInstance().getHttpsCallable("transitionGuardianVerification")'));
  const runner = read('scripts/qa/local-team-access-ui.mjs');
  assert(runner.indexOf('assertInstrumentationPassed(transcript, 1)') < runner.indexOf('isolation = await verifyTeamAccessNativeRecords'));
  for (const marker of ['notificationsVerified: false', 'physicalDevice: false', 'fullProcessRestartProven: false',
    'guardianRenewalThroughSdkNotUi: true', 'await deleteApp(getApp())', 'resetDisposableLocalApps(adb, serial)']) assert(runner.includes(marker), marker);
  const records = read('scripts/qa/team-access-native-records.mjs');
  for (const marker of ["'teamEnrollmentEvents'", "'guardianVerificationEvents'", 'verifyTeamChatProtectedBaseline(f)',
    'messageOperations: 7', 'f.otherParent', 'marker.messages.afterRenewal', 'marker.messages.otherReply']) assert(records.includes(marker), marker);
});
test('native team input waits for the focused window and settled keyboard before its one physical send tap', () => {
  const source = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/NativeTeamMessageInput.kt');
  for (const marker of ['window.awaitFocus(15_000)', 'input.assertIsEnabled().performClick().assertIsFocused()',
    'animations.isEmpty()', 'WindowInsetsCompat.Type.ime()', 'input.assertTextEquals(body)',
    'bounds.bottom + origin[1] - local[1] <= visible.bottom + 2', 'ViewCompat.setWindowInsetsAnimationCallback(root, null)',
    'throw failure', 'team-send-failure-window.png']) assert(source.includes(marker), marker);
  assert.equal(source.split('button.performClick()').length - 1, 1);
  assert(!/Thread.sleep|performSemanticsAction|pressBack|\.hide\(/.test(source));
  assert(source.indexOf('animations.isEmpty()') < source.indexOf('button.performClick()'));
  assert(source.indexOf('input.assertTextEquals(body)') < source.indexOf('button.performClick()'));
});
