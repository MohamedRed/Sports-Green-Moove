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
