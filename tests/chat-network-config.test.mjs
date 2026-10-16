import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { assertChatNetworkReceipt } from '../scripts/qa/chat-network-evidence.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const native = (name) => read(`android/app/src/androidTest/java/be/sportgreenmoove/app/ui/${name}.kt`);
function receipt() {
  const connected = { wifiEnabled: true, mobileDataEnabled: true, activeNetwork: true,
    backendReachable: true, internetNetworkCount: 1 };
  return { projectId: 'demo-sgm-local-qa', scope: 'native-ui-with-disposable-os-network-control', completed: true,
    offlineSendUnconfirmed: true, offlineDraftRetained: true, recoveredSendConfirmed: true,
    accountDraftCleared: true, replyReceived: true,
    network: [{ phase: 'before', ...connected },
      { phase: 'offline', wifiEnabled: false, mobileDataEnabled: false, activeNetwork: false,
        backendReachable: false, internetNetworkCount: 0 }, { phase: 'restored', ...connected }] };
}

test('network evidence accepts only a complete offline and restored app replay', () => {
  assertChatNetworkReceipt(receipt());
  const disabledData = receipt();
  disabledData.network[0].mobileDataEnabled = false;
  disabledData.network[2].mobileDataEnabled = false;
  assertChatNetworkReceipt(disabledData);
  for (const key of ['completed', 'offlineSendUnconfirmed', 'offlineDraftRetained',
    'recoveredSendConfirmed', 'accountDraftCleared', 'replyReceived']) {
    const invalid = receipt(); invalid[key] = false;
    assert.throws(() => assertChatNetworkReceipt(invalid));
  }
});

test('offline requires both OS disconnection and an unreachable backend', () => {
  for (const [key, value] of [['wifiEnabled', true], ['mobileDataEnabled', true],
    ['activeNetwork', true], ['backendReachable', true], ['internetNetworkCount', 1]]) {
    const invalid = receipt(); invalid.network[1][key] = value;
    assert.throws(() => assertChatNetworkReceipt(invalid));
  }
  for (const index of [0, 2]) {
    const invalid = receipt(); invalid.network[index].backendReachable = false;
    assert.throws(() => assertChatNetworkReceipt(invalid));
  }
  const altered = receipt(); altered.network[2].mobileDataEnabled = false;
  assert.throws(() => assertChatNetworkReceipt(altered));
});

test('network control refuses non-demo, non-local and non-disposable targets', () => {
  const control = native('LocalEmulatorNetwork');
  for (const guard of ['BuildConfig.DEBUG && BuildConfig.SGM_USE_FIREBASE_EMULATOR',
    'context.packageName == "be.sportgreenmoove.app.local"', 'options.projectId == "demo-sgm-local-qa"',
    'session.getBoolean("disposableEmulator")', 'getprop ro.kernel.qemu',
    'setOf("10.0.2.2", "127.0.0.1", "localhost")']) assert(control.includes(guard));
  assert.match(control, /Socket\(\).use/);
  assert.match(control, /5001/);
  assert.match(control, /override fun close\(\) \{ restore\(\) \}/);
  assert.match(control, /finally \{ device.executeShellCommand\("svc data/);
  assert.match(read('android/app/src/localDebug/AndroidManifest.xml'), /ACCESS_NETWORK_STATE/);
});

test('app replay requires actual unconfirmed send, retry and cross-account draft assertions', () => {
  const replay = native('LocalChatNetworkFlowTest');
  assert.match(replay, /LocalEmulatorNetwork\(context, device, session\).use/);
  assert.match(replay, /control.offline\(\)/);
  assert.match(replay, /assertFalse\(.*control.backendReachable\(\)\)/);
  assert.match(replay, /waitForText\("Envoi non confirmé\. Réessayez\."/);
  assert.match(replay, /assertContentDescriptionEquals\("Réessayer l'envoi"\)/);
  assert.match(replay, /performTextReplacement\(privateDraft\)/);
  assert.match(replay, /login\("driver"\)[\s\S]*assertDraft\(""\)/);
  assert.match(replay, /waitForReadAcknowledgement\(context\)/);
  assert.match(replay, /put\("completed", false\).put\("failedPhase", phase\)/);
  const runner = read('scripts/qa/local-android-session.mjs');
  assert.match(runner, /instrument\(\['LocalChatNetworkFlowTest'\], 1\)/);
  assert.match(runner, /verifyChatNetworkUi\(networkFixture, evidenceDir\)/);
  assert.match(runner, /finally \{ run\(adb, \['-s', serial, 'shell', 'svc', 'data'/);
  const verifier = read('scripts/qa/local-chat-network-ui.mjs');
  assert.match(verifier, /assert.equal\(messages.size, 2/);
  assert.match(verifier, /assert.equal\(notes.size, 1\)/);
  assert.match(verifier, /readByUserIds/);
  assert.match(verifier, /assert.equal\(note.read, true\)/);
});

test('SDK conversation replays queue composition effects instead of running them inline on callback threads', () => {
  for (const name of ['LocalChatFlowTest', 'LocalChatNetworkFlowTest']) {
    assert.match(native(name), /createEmptyComposeRule\(effectContext = StandardTestDispatcher\(\)\)/);
  }
  assert.match(read('android/app/build.gradle.kts'), /androidTestImplementation\("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2"\)/);
});

test('conversation booking statuses match the backend contract without dropping refused reservations', () => {
  const ast = ts.createSourceFile('types.ts', read('functions/src/domain/types.ts'), ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === 'BookingStatus');
  assert(declaration && ts.isUnionTypeNode(declaration.type));
  const expected = declaration.type.types.map((node) => {
    assert(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal));
    return node.literal.text;
  });
  const model = read('android/app/src/main/java/be/sportgreenmoove/app/data/ConversationDirectoryModels.kt');
  const enumeration = model.match(/enum class ConversationBookingStatus[^\n]*\{([\s\S]*?)\n\}/)?.[1];
  assert(enumeration);
  const actual = [...enumeration.matchAll(/\w+\("([a-z]+)",/g)].map((match) => match[1]);
  assert.deepEqual(actual.sort(), expected.sort());
  assert.match(read('scripts/qa/local-chat-network-ui.mjs'), /bookingStatuses.includes\('declined'\)/);
  assert.match(read('scripts/qa/local-chat-network-ui.mjs'), /bookingStatuses.includes\('cancelled'\)/);
});
