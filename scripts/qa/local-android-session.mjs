import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { verifyLocalRideUi } from './verify-local-ride-ui.mjs';
import { verifyLocalChatUi } from './verify-local-chat-ui.mjs';
import { seedChatDirectoryUiFixtures } from './local-chat-directory-ui-fixtures.mjs';
import { verifyLocalChatDirectoryUi } from './verify-local-chat-directory-ui.mjs';

const root = resolve(import.meta.dirname, '../..');
const session = await seedLocalUiFixtures();
const serial = process.env.SGM_LOCAL_ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial), 'Physical devices are not supported by this local fixture runner');
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : 'adb';
const run = (command, args) => execFileSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', timeout: 20 * 60_000 });
const android = resolve(root, 'android');
run(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
  '-PSGM_USE_FIREBASE_EMULATOR=true', '--no-daemon', '--max-workers=2']);
run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs/apk/debug/app-debug.apk')]);
run(adb, ['-s', serial, 'install', '-r', resolve(android, 'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')]);
run(process.execPath, [resolve(import.meta.dirname, 'install-local-ui-session.mjs'), serial, process.env.SGM_LOCAL_UI_SESSION_FILE]);

function instrument(classes, expected) {
  const output = execFileSync(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'timeout_msec', '240000',
    '-e', 'class', classes.map((name) => `be.sportgreenmoove.app.ui.${name}`).join(','),
    'be.sportgreenmoove.app.local.test/androidx.test.runner.AndroidJUnitRunner'],
  { env: process.env, encoding: 'utf8', timeout: 12 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  console.log(output.replaceAll(session.password, '[REDACTED]'));
  assertInstrumentationPassed(output, expected);
}

const output = process.env.SGM_LOCAL_UI_OUTPUT;
mkdirSync(output, { recursive: true });
let capturesCollected = false;
try {
  instrument(['LocalAppFlowTest', 'LocalDriverFlowTest', 'LocalLandscapeLoginTest', 'LocalUiRegressionTest'], 5);
  instrument(['LocalThemeRestartTest'], 1);
  for (const permission of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'ACCESS_BACKGROUND_LOCATION', 'POST_NOTIFICATIONS']) {
    run(adb, ['-s', serial, 'shell', 'pm', 'grant', 'be.sportgreenmoove.app.local', `android.permission.${permission}`]);
  }
  run(adb, ['-s', serial, 'shell', 'appops', 'set', 'be.sportgreenmoove.app.local', 'android:mock_location', 'allow']);
  instrument(['LocalRideFlowTest'], 1);
  const ride = await verifyLocalRideUi();
  instrument(['LocalChatFlowTest'], 1);
  const chat = await verifyLocalChatUi();
  const directoryFixture = await seedChatDirectoryUiFixtures();
  instrument(['LocalConversationDirectoryFlowTest'], 1);
  const directory = await verifyLocalChatDirectoryUi(directoryFixture);
  run(adb, ['-s', serial, 'pull', '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence/.', output]);
  capturesCollected = true;
  const steps = ['parent-app-ui', 'driver-approval-ui', 'landscape-login-ui', 'calendar-empty-consent-ui', 'theme-process-restart-ui',
    'ride-lifecycle-ui', 'ride-review-ui', 'ride-ledgers-ui', 'chat-conversation-ui', 'chat-directory-ui']
    .map((id) => ({ id, status: 'passed' }));
  writeFileSync(resolve(output, 'results.json'), `${JSON.stringify({ projectId: session.projectId,
    runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), scope: 'local-ui-not-physical-device',
    testCount: 9, steps, ride, chat, directory, limits: ['Synthetic mock positions and pre-granted emulator permissions only.',
      'No physical GPS tracking, provider payments, push delivery or live data tested.'] }, null, 2)}\n`);
} finally {
  if (!capturesCollected) {
    try { run(adb, ['-s', serial, 'pull', '/sdcard/Android/data/be.sportgreenmoove.app.local/files/local-ui-evidence/.', output]); }
    catch { console.warn('Could not collect local UI diagnostic captures.'); }
  }
  run(adb, ['-s', serial, 'shell', 'appops', 'set', 'be.sportgreenmoove.app.local', 'android:mock_location', 'default']);
  run(adb, ['-s', serial, 'shell', 'run-as', 'be.sportgreenmoove.app.local', 'rm', '-f', 'files/local-qa-session.json']);
}
