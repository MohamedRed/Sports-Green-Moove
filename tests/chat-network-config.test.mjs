import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { assertChatNetworkReceipt, assertCellularRequestSetup, assertObservedCellularHandover } from '../scripts/qa/chat-network-evidence.mjs';
import { networkRestoreCommands } from '../scripts/qa/local-network-replay.mjs';
import { finishDisposableCleanup, waitForDisposableDevice } from '../scripts/qa/disposable-device-cleanup.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const native = (name) => read(`android/app/src/androidTest/java/be/sportgreenmoove/app/ui/${name}.kt`);
function receipt() {
  const connected = { wifiEnabled: true, mobileDataEnabled: true, activeNetwork: true,
    backendReachable: true, internetNetworkCount: 1 };
  return { projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), scope: 'native-ui-with-disposable-os-network-control', completed: true,
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
  assert.match(control, /finishLocalNetworkCleanup\(null, ::restore, cellular::close, wireless::close\)/);
  assert.match(control, /finally \{ device.executeShellCommand\("svc data/);
  assert.match(control, /initialData = telephony.isDataEnabled/);
  assert.match(control, /initialWifi = wifi.isWifiEnabled/);
  assert(!control.includes('settings get global'));
  assert.match(read('android/app/src/localDebug/AndroidManifest.xml'), /ACCESS_NETWORK_STATE/);
});

test('app replay requires actual unconfirmed send, retry and cross-account draft assertions', () => {
  const replay = native('LocalChatNetworkFlowTest');
  assert.match(replay, /val control = LocalEmulatorNetwork\(context, device, session\)[\s\S]*control.use \{/);
  assert.match(replay, /control.offline\(\)/);
  assert.match(replay, /assertFalse\(.*control.backendReachable\(\)\)/);
  assert.match(replay, /waitForText\("Envoi non confirmé\. Réessayez\."/);
  assert.match(replay, /assertContentDescriptionEquals\("Réessayer l'envoi"\)/);
  assert.match(replay, /typeDraft\(privateDraft\)/);
  assert.match(replay, /performClick\(\).assertIsFocused\(\)/);
  assert.match(replay, /abs\(input.fetchSemanticsNode\(\).boundsInRoot.top - restingTop\) < 2f/);
  assert.match(replay, /login\("driver"\)[\s\S]*assertDraft\(""\)/);
  assert.match(replay, /waitForReadAcknowledgement\(context\)/);
  assert.match(replay, /put\("completed", false\).put\("failedPhase", phase\)/);
  const runner = read('scripts/qa/local-android-session.mjs');
  assert.match(runner, /replayWithNetworkCleanup\(adb, serial, session.runId, instrument\)/);
  assert.match(runner, /verifyChatNetworkUi\(networkFixture, evidenceDir\)/);
  const cleanup = read('scripts/qa/local-network-replay.mjs');
  assert.match(cleanup, /assert.equal\(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true'\)/);
  assert.match(cleanup, /'getprop', 'ro.kernel.qemu'/);
  assert.match(cleanup, /instrument\(\['LocalChatNetworkFlowTest'\], 1\)/);
  assert.match(cleanup, /finishDisposableCleanup\(undefined, commands.map/);
  assert.match(cleanup, /waitForDisposableDevice\(adb, serial\)/);
  assert.match(cleanup, /timeout: 30_000/);
  assert(replay.indexOf('writeResult(context, result)', replay.indexOf('network.put(checkNotNull(preparedEvidence))')) < replay.indexOf('control.disconnect {'));
  assert.match(replay, /control.snapshot\("disconnect-failed"\)/);
  assert.match(replay, /control.cellularReadySnapshot\(\)/);
  assert.match(replay, /network.put\(checkNotNull\(cellularEvidence\)\)/);
  const verifier = read('scripts/qa/local-chat-network-ui.mjs');
  assert.match(verifier, /assert.equal\(messages.size, 2/);
  assert.match(verifier, /assert.equal\(notes.size, 1\)/);
  assert.match(verifier, /readByUserIds/);
  assert.match(verifier, /assert.equal\(note.read, true\)/);
});

test('device evidence collection waits for one bounded, confirmed disposable transport without restarting or retrying tests', () => {
  const before = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  try {
    const calls = [];
    const execute = (adb, args, options) => {
      calls.push(args);
      assert.equal(adb, 'adb'); assert.equal(options.timeout, 30_000);
      return args.includes('get-state') ? 'device\n' : args.includes('getprop') ? '1\n' : '';
    };
    waitForDisposableDevice('adb', 'emulator-5554', execute);
    assert.deepEqual(calls, [['-s', 'emulator-5554', 'wait-for-device'],
      ['-s', 'emulator-5554', 'get-state'], ['-s', 'emulator-5554', 'shell', 'getprop', 'ro.kernel.qemu']]);
    assert.throws(() => waitForDisposableDevice('adb', 'physical', execute));
    const timeout = new Error('transport deadline');
    assert.throws(() => waitForDisposableDevice('adb', 'emulator-5554', () => { throw timeout; }), (error) => error === timeout);
    assert.throws(() => waitForDisposableDevice('adb', 'emulator-5554', () => 'offline'));
    const runner = read('scripts/qa/local-android-session.mjs');
    assert.match(runner, /collectEvidence\('network-recovery'\)/);
    const collector = read('scripts/qa/collect-local-ui-evidence.mjs');
    assert(collector.indexOf('waitForDisposableDevice(adb, serial, execute)') < collector.indexOf("spawn(adb, ['-s', serial, 'pull'"));
    assert.match(runner, /finishDisposableCleanup\(failure, \[/);
    assert(runner.indexOf("writeFileSync(resolve(evidenceDir, 'results.json')") > runner.indexOf('finishDisposableCleanup(failure'));
  } finally {
    if (before === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
    else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = before;
  }
});

test('cleanup attempts every step and preserves the original failure together with cleanup errors', () => {
  const primary = new Error('original replay failure'), cleanup = new Error('permission reset failure');
  const calls = [];
  assert.throws(() => finishDisposableCleanup(primary, [
    () => { calls.push('reset'); throw cleanup; }, () => calls.push('remove session'),
  ]), (error) => error instanceof AggregateError && error.errors[0] === primary && error.errors[1] === cleanup);
  assert.deepEqual(calls, ['reset', 'remove session']);
  assert.throws(() => finishDisposableCleanup(primary, [() => {}]), (error) => error === primary);
  assert.throws(() => finishDisposableCleanup(undefined, [() => { throw cleanup; }]), (error) => error === cleanup);
  assert.doesNotThrow(() => finishDisposableCleanup(undefined, [() => {}]));
});

test('new network replays prove cellular handover without weakening the recorded offline requirements', () => {
  const ui = receipt();
  const cellular = { phase: 'cellular-ready', wifiEnabled: false, mobileDataEnabled: true,
    activeNetwork: true, backendReachable: true, internetNetworkCount: 1, internetTransports: ['cellular'] };
  ui.network.splice(1, 0, cellular);
  assertChatNetworkReceipt(ui);
  cellular.wifiEnabled = true;
  assert.throws(() => assertChatNetworkReceipt(ui));
  cellular.wifiEnabled = false; cellular.backendReachable = false;
  assert.throws(() => assertChatNetworkReceipt(ui));
  cellular.backendReachable = true; ui.network[2].mobileDataEnabled = true;
  assert.throws(() => assertChatNetworkReceipt(ui));
  const control = native('LocalEmulatorNetwork');
  const disable = control.slice(control.indexOf('fun disconnect('), control.indexOf('fun cellularReady'));
  assert(disable.indexOf('awaitCellular()') < disable.indexOf('svc data disable'));
  assert.match(read('scripts/qa/chat-network-evidence.mjs'), /A newly recorded run must prove cellular handover/);
});

test('cellular preparation is local-only, guarded, bounded and explicitly released without changing the app route', () => {
  const control = native('LocalEmulatorNetwork');
  const request = native('LocalRequestedTransport');
  assert(control.indexOf('cellular.start()') > control.indexOf('getprop ro.kernel.qemu'));
  assert.match(control, /check\(initialWifi && initialData\)/);
  assert.match(request, /addTransportType\(transport\)[\s\S]*NET_CAPABILITY_INTERNET/);
  assert.match(request, /unregisterNetworkCallback\(callback\)\s*registered = false/);
  assert(!/bindProcessToNetwork|NET_CAPABILITY_VALIDATED|settings put global|gsm data/.test(control + request));
  assert.match(native('LocalChatNetworkFlowTest'), /compose.waitUntil\(30_000\) \{\s*preparedEvidence = control.preparedSnapshot\(\)/);
  assert.match(read('android/app/src/localDebug/AndroidManifest.xml'), /CHANGE_NETWORK_STATE/);
  assert(!read('android/app/src/main/AndroidManifest.xml').includes('CHANGE_NETWORK_STATE'));
  assert.match(read('scripts/qa/local-chat-network-ui.mjs'), /assertTransportRequestSetup\(ui\)/);
});

function preparedReceipt(dataEnabled = true) {
  const ui = receipt();
  ui.setupMethod = 'requested-cellular-network'; ui.cellularRequestReleased = true;
  ui.preparation = { phase: 'preparing', cellularRequestRegistered: dataEnabled };
  ui.network[0].internetTransports = dataEnabled ? ['wifi', 'cellular'] : ['wifi'];
  if (dataEnabled) ui.network.splice(1, 0, { phase: 'cellular-ready', wifiEnabled: false,
    mobileDataEnabled: true, activeNetwork: true, backendReachable: true,
    internetNetworkCount: 1, internetTransports: ['cellular'] });
  for (const state of ui.network) {
    state.cellularRequestRegistered = dataEnabled;
    if (!dataEnabled) state.mobileDataEnabled = false;
  }
  return ui;
}

test('new receipts require preparation, the requested route, release and the unchanged offline proof', () => {
  const validate = (ui) => { assertChatNetworkReceipt(ui); assertCellularRequestSetup(ui); };
  validate(preparedReceipt()); validate(preparedReceipt(false));
  assert.throws(() => assertCellularRequestSetup(receipt()));
  for (const mutate of [
    (ui) => { ui.setupMethod = 'unknown'; }, (ui) => { ui.cellularRequestReleased = false; },
    (ui) => { ui.preparation.phase = 'before'; }, (ui) => { ui.preparation.cellularRequestRegistered = false; },
    (ui) => { ui.network[0].internetTransports = ['wifi']; },
    (ui) => { ui.network[0].internetTransports = ['cellular']; },
    (ui) => { ui.network[2].cellularRequestRegistered = false; },
    (ui) => { ui.network[2].mobileDataEnabled = true; },
    (ui) => { ui.network.splice(1, 1); },
  ]) {
    const ui = preparedReceipt(); mutate(ui); assert.throws(() => validate(ui));
  }
});

test('fresh handover evidence uses the same exclusive cellular observation that released its wait', () => {
  const complete = preparedReceipt(); complete.handoverObservationVersion = 1;
  complete.network[1].activeInternetTransports = ['cellular'];
  assertObservedCellularHandover(complete);
  for (const mutate of [
    (ui) => { delete ui.handoverObservationVersion; }, (ui) => { ui.handoverObservationVersion = 2; },
    (ui) => { ui.network[1].internetTransports.push('wifi'); },
    (ui) => { ui.network[1].activeInternetTransports = ['wifi']; },
    (ui) => { ui.network[1].internetTransports.push('vpn'); },
    (ui) => { delete ui.network[1].activeInternetTransports; },
  ]) { const ui = structuredClone(complete); mutate(ui); assert.throws(() => assertObservedCellularHandover(ui)); }
  const replay = native('LocalChatNetworkFlowTest');
  assert.match(replay, /cellularEvidence = control.cellularReadySnapshot\(\)/);
  assert.match(replay, /network.put\(checkNotNull\(cellularEvidence\)\)/);
  assert(!replay.includes('control.snapshot("cellular-ready")'));
  assert.match(native('LocalEmulatorNetwork'), /snapshot\("cellular-ready"\).takeIf\(::isExclusiveCellularObservation\)/);
  const predicate = native('LocalCellularObservation');
  assert.match(predicate, /transports\("activeInternetTransports"\) == setOf\("cellular"\)/);
  assert.match(predicate, /transports\("internetTransports"\) == setOf\("cellular"\)/);
  assert.match(read('scripts/qa/local-chat-network-ui.mjs'), /assertTransportRequestSetup\(ui\)/);
  assert.match(read('scripts/qa/chat-network-evidence.mjs'), /export function assertTransportRequestSetup[\s\S]*assertObservedCellularHandover\(ui\)/);
});

test('host cleanup uses the current run actual state and rejects stale or ambiguous receipts', () => {
  const ui = receipt();
  ui.network[0].mobileDataEnabled = false;
  assert.deepEqual(networkRestoreCommands(ui, ui.runId), [
    ['shell', 'svc', 'wifi', 'enable'], ['shell', 'svc', 'data', 'disable'],
  ]);
  assert.throws(() => networkRestoreCommands(ui, 'b'.repeat(32)));
  assert.throws(() => networkRestoreCommands({ ...ui, projectId: 'live' }, ui.runId));
  assert.deepEqual(networkRestoreCommands({ ...ui, network: [] }, ui.runId), []);
  for (const key of ['wifiEnabled', 'mobileDataEnabled']) {
    const invalid = receipt(); invalid.network[0][key] = null;
    assert.throws(() => networkRestoreCommands(invalid, invalid.runId));
  }
});

test('all isolated SDK app replays share queued composition effects rather than applying views on callback threads', () => {
  assert.match(native('LocalComposeRule'), /createEmptyComposeRule\(effectContext = StandardTestDispatcher\(\)\)/);
  for (const name of ['LocalAppFlowTest', 'LocalDriverFlowTest', 'LocalBookingDecisionsFlowTest',
    'LocalConversationDirectoryFlowTest', 'LocalChatFlowTest', 'LocalChatNetworkFlowTest',
    'LocalRideFlowTest', 'LocalMembershipFlowTest', 'LocalLandscapeLoginTest', 'LocalThemeRestartTest', 'LocalChatProcessRestartTest']) {
    assert.match(native(name), /@get:Rule val compose = createLocalAppComposeRule\(\)/);
    assert(!native(name).includes('createEmptyComposeRule'));
  }
  assert.match(read('android/app/build.gradle.kts'), /androidTestImplementation\("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2"\)/);
  assert.equal(read('.github/workflows/web-integration-smoke.yml').split(
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/Local*.kt').length - 1, 2);
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

test('CI installs the parser before checking the cross-platform booking contract', () => {
  const workflow = read('.github/workflows/native-ci.yml');
  const job = workflow.slice(workflow.indexOf('  native-ui-coverage:'), workflow.indexOf('  android-native-unit:'));
  assert(job.indexOf('run: npm ci') > 0);
  assert(job.indexOf('run: npm ci') < job.indexOf('tests/chat-network-config.test.mjs'));
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  for (const path of ['.github/workflows/native-ci.yml',
    'android/app/src/main/java/be/sportgreenmoove/app/data/ConversationDirectoryModels.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/ConversationDirectoryMappers.kt']) {
    assert.equal(smoke.split(`"${path}"`).length - 1, 2);
  }
});
