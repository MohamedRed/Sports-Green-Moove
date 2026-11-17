import assert from 'node:assert/strict';

const original = [
  ...['install-disposable-test-apks', 'preinstalled-disposable-apks', 'continuous-disposable-device',
    'configure-continuous-disposable', 'restore-continuous-disposable', 'reset-disposable-local-apps',
    'disposable-installations', 'disposable-install-admin', 'local-session-restoration-ui',
    'run-local-session-restoration-ui', 'session-restoration-fault-proxy', 'session-restoration-records',
    'run-isolated-ride-ui', 'local-emulator-lifecycle', 'local-ui-fixtures'].map(name => 'scripts/qa/' + name + '.mjs'),
  'scripts/run-focused-android-ui.sh', '.github/workflows/native-focused-ui.yml', 'functions/src/callables/adminUsers.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidRuntime.kt',
  ...['SessionRestoration', 'SessionRestorationState', 'SportsGreenMooveApp', 'AppDataState', 'AppSessionShutdown']
    .map(name => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + name + '.kt'),
  ...['DisposableAndroidJUnitRunner', 'LocalSessionRestorationTest', 'LocalUiCapture']
    .map(name => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + name + '.kt'),
];
const transport = ['scripts/qa/android-case-apks.mjs', 'scripts/qa/session-transport-observations.mjs',
  'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalSessionTransportDiagnostics.kt'];
export function assertSessionRestorationSourceLayout(files, layout = 'original') {
  assert(['original', 'transport-observed', 'failure-observed'].includes(layout), 'Unsupported restoration source layout');
  const expected = [...original, ...(layout === 'original' ? [] : transport),
    ...(layout === 'failure-observed' ? ['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SessionFailureObservation.kt'] : [])];
  assert(files && typeof files === 'object' && !Array.isArray(files));
  assert.deepEqual(Object.keys(files).sort(), expected.sort(), 'Every source in the selected restoration layout is required');
  for (const value of Object.values(files)) assert.match(value, /^[a-f0-9]{64}$/);
}
