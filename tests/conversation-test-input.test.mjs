import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const base = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';

test('conversation component input waits for the actual keyboard without replacing physical clicks or extending error deadlines', () => {
  const helper = read(base + 'ConversationTestInteractions.kt');
  assert.match(helper, /WindowInsetsAnimationCompat.Callback\(DISPATCH_MODE_CONTINUE_ON_SUBTREE\)/);
  assert.match(helper, /animation.typeMask and WindowInsetsCompat.Type.ime\(\)/);
  assert.match(helper, /insets.isVisible\(WindowInsetsCompat.Type.ime\(\)\) == visible && imeAnimations.isEmpty\(\)/);
  assert(helper.indexOf('awaitKeyboard(true)') < helper.indexOf('input.performTextReplacement(value)'));
  assert(helper.indexOf('awaitKeyboard(keyboardVisible)') < helper.indexOf('button.performClick()'));
  assert(helper.includes('button.assertIsEnabled().assertIsDisplayed()'));
  assert(helper.includes('getWindowVisibleDisplayFrame(visible)'));
  assert(helper.includes('bounds.bottom + origin[1] - local[1] <= visible.bottom + 2'));
  assert(helper.includes('gateway.requests.size == expectedRequests'));
  assert(!/Thread.sleep|waitForTimeout|performSemanticsAction/.test(helper));
  assert(helper.indexOf('if (!keyboardVisible) compose.runOnUiThread') < helper.indexOf('.hide(WindowInsetsCompat.Type.ime())'));
  assert.match(helper, /setWindowInsetsAnimationCallback\(compose.activity.window.decorView, null\)/);
});

test('the uncertainty and rejection cases retain the same requests, message contents and explicit error assertions', () => {
  const screen = read(base + 'ConversationFlowTest.kt');
  assert.equal((screen.match(/@Test fun /g) ?? []).length, 6);
  assert(screen.includes('interactions.send(gateway, expectedRequests = 1, keyboardVisible = true)'));
  assert(screen.includes('interactions.send(gateway, expectedRequests = 2, keyboardVisible = false)'));
  assert(screen.includes('interactions.send(gateway, expectedRequests = 3, keyboardVisible = false)'));
  assert(screen.includes('assertEquals(gateway.requests[0].requestId, gateway.requests[1].requestId)'));
  assert(screen.includes('assertEquals(gateway.requests[0].body, gateway.requests[1].body)'));
  assert(screen.includes('assertEquals(1, gateway.requests.map { it.requestId }.distinct().size)'));
  assert(screen.includes('waitForText("Envoi non confirmé. Réessayez.")'));
  assert(screen.includes('waitForText("Envoi refusé. Vérifiez le message et réessayez.")'));
  assert.match(screen, /private fun waitForText\(text: String\) = compose.waitUntil\(5_000\)/);
  assert(screen.includes('@After fun releaseInteractions()'));
});

test('field touches wait for their own resumed focused window, including dialogs', () => {
  const readiness = read(base + 'InputWindowReadiness.kt');
  assert(readiness.includes('input.fetchSemanticsNode().root as? ViewRootForTest'));
  assert(readiness.includes('view.isAttachedToWindow && view.windowToken != null'));
  assert(readiness.includes('root.isLifecycleInResumedState && view.hasWindowFocus()'));
  assert(readiness.includes('if (inspectEditor) manager.isActive(view) else null'));
  for (const observation of ['power.isInteractive', 'keyguard.isKeyguardLocked', 'keyguard.isDeviceLocked',
    'view.rootView.isShown', 'view.windowVisibility', 'view.display?.state']) assert(readiness.includes(observation));
  assert(!/wakeUp|requestDismissKeyguard|executeShellCommand|FLAG_KEEP_SCREEN_ON|\.requestFocus\(/.test(readiness));
  assert(!/requestFocus|showSoftInput|\.show\(|Thread.sleep|performSemanticsAction/.test(readiness));
  const conversation = read(base + 'ConversationTestInteractions.kt');
  assert(conversation.indexOf('window.awaitFocus(5_000)') < conversation.indexOf('input.assertIsEnabled().performClick()'));
  assert(conversation.includes('compose.waitUntil(5_000)'));
  const form = read(base + 'TripFormTestInput.kt');
  assert(form.indexOf('window.awaitFocus(15_000)') < form.indexOf('input.performClick()'));
  assert(form.includes('compose.waitUntil(15_000) { window.keyboardVisible() }'));
  assert(!form.includes('WindowInspector'));
  const probes = read(base + 'InputWindowReadinessTest.kt');
  assert.equal((probes.match(/@Test fun /g) ?? []).length, 2);
  assert(probes.includes('activityInputUsesItsOwnFocusedWindowAndRealKeyboard'));
  assert(probes.includes('dialogInputUsesItsOwnFocusedWindowAndRealKeyboard'));
  assert(probes.includes('input.assertTextEquals("QA input")'));
  for (const name of ['InputWindowReadiness.kt', 'InputWindowReadinessTest.kt']) {
    assert(read(base + name).split('\n').length < 300);
    assert.equal(read('.github/workflows/web-integration-smoke.yml').split('"' + base + name + '"').length - 1, 2);
  }
});

test('both CI entry points retain component input readiness coverage', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const source = read('.github/workflows/' + name);
    assert.equal(source.split('"tests/conversation-test-input.test.mjs"').length - 1, 2);
  }
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"' + base + 'ConversationTestInteractions.kt"').length - 1, 2);
  assert(JSON.parse(read('package.json')).scripts['test:local-flow-isolation'].includes('tests/conversation-test-input.test.mjs'));
});

test('the retained component failure is the original first-error wait, not a failed database or copy assertion', () => {
  const xml = read('docs/release/evidence/local-ui-collection-2026-10-16/component-before.xml');
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    processEntities: false, isArray: (name) => name === 'testcase' }).parse(xml).testsuite;
  assert.equal(suite.tests, 69); assert.equal(suite.failures, 1); assert.equal(suite.skipped, 15);
  const failed = suite.testcase.filter((item) => item.failure);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].name, 'uncertainSendsKeepTheirIdentityAndTextUntilTheRetryIsConfirmed');
  assert.equal(failed[0].classname, 'be.sportgreenmoove.app.ui.ConversationFlowTest');
  assert.match(failed[0].failure, /ConversationFlowTest.kt:56/); assert.match(failed[0].failure, /after 5000 ms/);
});

test('passing device assertions from the interrupted copy attempt are retained without fabricating completed host verification', () => {
  const root = 'docs/release/evidence/local-ui-collection-2026-10-16/';
  const before = JSON.parse(read(root + 'network-preparation-failed.json'));
  assert.equal(before.runId, '3b96c544b35c200db6cf14cc61e14496'); assert.equal(before.completed, false);
  assert.equal(before.failedPhase, 'network-preparation'); assert.deepEqual(before.network, []);
  assert.equal(before.preparationFailure.hasDefaultDataSubscription, false);
  const after = JSON.parse(read(root + 'network-device-completed-without-host-verification.json'));
  assert.equal(after.runId, '6f43720bb06338239b4827fb623124c4'); assert.equal(after.completed, true);
  assert.equal(after.network.find((item) => item.phase === 'offline').backendReachable, false);
  const files = readdirSync(new URL('../' + root + 'attempt-two-instrumentation/', import.meta.url));
  assert.equal(files.length, 12);
  let total = 0;
  for (const file of files) {
    assert(file.endsWith('-instrumentation.txt'));
    const count = file.startsWith('LocalAppFlowTest-') ? 9 : 1;
    assertInstrumentationPassed(read(root + 'attempt-two-instrumentation/' + file), count);
    total += count;
  }
  assert.equal(total, 20); assert.equal(existsSync(new URL('../' + root + 'results.json', import.meta.url)), false);
  assert.match(read(root + 'README.md'), /diagnostic evidence, not an accepted complete replay/);
});

test('retained diagnostic files preserve original bytes, including XML line endings and transcript terminal blank lines', () => {
  const base = 'docs/release/evidence/local-ui-collection-2026-10-16/';
  const hashes = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(hashes).length, 15);
  for (const [path, expected] of Object.entries(hashes)) {
    assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, base, path))).digest('hex'), expected, path);
  }
  assert.match(read(base + '.gitattributes'), /component-before.xml -text/);
});

test('the later focus and primary-copy failures cannot become schedule or complete replay evidence', () => {
  const base = 'docs/release/evidence/local-schedule-preparation-2026-10-17/';
  const json = (name) => JSON.parse(read(base + name));
  const hashes = json('artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 8);
  for (const [name, hash] of Object.entries(hashes)) {
    const bytes = readFileSync(resolve(root, base, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, name);
    assert.doesNotMatch(bytes.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|-----BEGIN .*PRIVATE KEY|"password"\s*:/);
  }
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(base + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 104); assert.equal(suite.failures, 9); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 22);
  const failed = suite.testcase.filter((item) => Object.hasOwn(item, 'failure'));
  assert.equal(failed.length, 9); assert(failed.every((item) => /InputWindowReadiness.awaitFocus/.test(item.failure)));
  assert.equal(failed.filter((item) => item.classname.endsWith('.InputWindowReadinessTest')).length, 2);
  for (const name of ['activity-input-logcat.txt', 'dialog-input-logcat.txt']) {
    const log = read(base + name);
    for (const phase of ['before-window-focus', 'window-focus-failed']) {
      assert.match(log, new RegExp(`phase=${phase} attached=true windowTokenPresent=true resumed=true windowFocused=false`));
    }
    assert.doesNotMatch(log, /phase=\S+-keyboard-visible/);
  }
  const primary = json('adb-pull-trip-change-parent-confirmation.json'), cleanup = json('adb-pull-failure-cleanup.json');
  assert.equal(primary.runId, 'c125527403f0a0f684268a4f1fbb46b0'); assert.equal(primary.completed, false);
  assert.equal(primary.status, 1); assert.equal(primary.signal, null); assert.equal(primary.errorCode, null);
  assert.match(primary.stderr, /building file list/); assert.equal(cleanup.runId, primary.runId); assert.equal(cleanup.completed, true);
  assertInstrumentationPassed(read(base + 'LocalTripChangeFlowTest-instrumentation.txt'), 1);
  assert.equal(json('local-trip-change-ui.json').runId, primary.runId); assert.equal(json('local-trip-change-ui.json').completed, true);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1 });
  for (const name of ['results.json', 'trip-change-ui-stage.json', 'trip-change-schedule-ui-stage.json']) {
    assert.equal(existsSync(resolve(root, base, name)), false);
  }
  assert.match(read(base + 'README.md'), /time\/address case and new date\/desired-arrival case were not reached/);
  assert.equal(read('.github/workflows/web-integration-smoke.yml').split('"' + base + '**"').length - 1, 2);
});
