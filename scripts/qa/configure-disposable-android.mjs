import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { pauseDisposableStore, restoreDisposableStore } from './disposable-store-pause.mjs';
import { prepareDisposableInstallAdmin, removeDisposableInstallAdmin } from './disposable-install-admin.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';

export function configureDisposableAndroid(env = process.env, execute = execFileSync) {
  assert(env.SGM_PAUSE_TEST_PHONE_STORE === undefined || ['true', 'false'].includes(env.SGM_PAUSE_TEST_PHONE_STORE), 'Invalid store pause selection');
  assert(env.SGM_BLOCK_TEST_PHONE_INSTALLS === undefined || ['true', 'false'].includes(env.SGM_BLOCK_TEST_PHONE_INSTALLS));
  const blockInstallations = env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true';
  assert(!blockInstallations || env.SGM_PAUSE_TEST_PHONE_STORE === 'true', 'Installation guard also requires the approved store pause');
  assert(!blockInstallations || env.SGM_TEST_PHONE_ADMIN_APPROVED === 'true', 'Temporary test administration requires explicit approval');
  const device = disposableAndroidShell(env, execute), { serial, shell } = device;
  const mapsRuntime = androidMapsPrerequisites(shell);
  assert.equal(shell('pm', 'path', launcher).startsWith('package:'), true, 'Expected Google APIs launcher missing');
  // This suite launches activities directly; exclude the independently crashing home app before execution.
  shell('pm', 'disable-user', '--user', '0', launcher);
  assert(shell('pm', 'list', 'packages', '-d', '--user', '0', launcher).split('\n')
    .includes(`package:${launcher}`), 'Launcher isolation was not applied');
  let installAdmin, storePause;
  try {
    installAdmin = blockInstallations ? prepareDisposableInstallAdmin(device, { approved: true }) : null;
    storePause = env.SGM_PAUSE_TEST_PHONE_STORE === 'true' ? pauseDisposableStore(shell, { blockInstallations }) : null;
    assert.deepEqual(androidMapsPrerequisites(shell), mapsRuntime, 'Maps runtime changed during test-device setup');
    return { serial, launcher, launcherDisabled: true, mapsRuntime, storePause, installAdmin,
      scope: 'disposable-emulator-without-home-navigation' };
  } catch (failure) {
    const errors = [failure];
    if (storePause) try { restoreDisposableStore(shell, storePause); } catch (cleanup) { errors.push(cleanup); }
    if (installAdmin) try { removeDisposableInstallAdmin(device, installAdmin); } catch (cleanup) { errors.push(cleanup); }
    throw new AggregateError(errors, 'Disposable test-device preparation failed; cleanup attempted');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(configureDisposableAndroid()));
}
