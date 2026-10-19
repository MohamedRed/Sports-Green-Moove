import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { pauseDisposableStore, restoreDisposableStore } from './disposable-store-pause.mjs';
import { prepareDisposableInstallAdmin, removeDisposableInstallAdmin } from './disposable-install-admin.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';

export function configureDisposableAndroid(env = process.env, execute = execFileSync,
  { prepareAdmin = prepareDisposableInstallAdmin } = {}) {
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
    storePause = env.SGM_PAUSE_TEST_PHONE_STORE === 'true' ? pauseDisposableStore(shell, { blockInstallations }) : null;
    installAdmin = blockInstallations ? prepareAdmin(device, { approved: true }) : null;
    assert.deepEqual(androidMapsPrerequisites(shell), mapsRuntime, 'Maps runtime changed during test-device setup');
    return { serial, launcher, launcherDisabled: true, mapsRuntime, storePause, installAdmin,
      scope: 'disposable-emulator-without-home-navigation' };
  } catch (failure) {
    const errors = [failure];
    let storeCleanup = null, adminCleanup = failure.receipt?.cleanup ?? null;
    if (storePause) try { storeCleanup = restoreDisposableStore(shell, storePause); }
    catch (cleanup) { storeCleanup = cleanup.receipt ?? null; errors.push(cleanup); }
    if (installAdmin) try { adminCleanup = removeDisposableInstallAdmin(device, installAdmin); }
    catch (cleanup) { errors.push(cleanup); }
    throw Object.assign(new AggregateError(errors, 'Disposable test-device preparation failed; cleanup attempted'), {
      receipt: { scope: 'failed-disposable-device-setup-not-flow-proof', serial, storeCleanup, adminCleanup,
        ...(failure.receipt?.scope === 'failed-disposable-admin-setup-not-flow-proof' ? { adminSetupFailure: failure.receipt } : {}),
        ...(failure.receipt?.scope === 'failed-store-pause-not-flow-proof' ? { storePauseFailure: failure.receipt } : {}) },
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(configureDisposableAndroid())); }
  catch (failure) { if (failure.receipt) console.log(JSON.stringify(failure.receipt)); throw failure; }
}
