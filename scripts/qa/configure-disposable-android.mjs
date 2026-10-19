import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { androidMapsPrerequisites } from './android-maps-prerequisites.mjs';
import { disposableAndroidShell } from './disposable-android-shell.mjs';
import { pauseDisposableStore } from './disposable-store-pause.mjs';

const launcher = 'com.google.android.apps.nexuslauncher';

export function configureDisposableAndroid(env = process.env, execute = execFileSync) {
  assert(env.SGM_PAUSE_TEST_PHONE_STORE === undefined || ['true', 'false'].includes(env.SGM_PAUSE_TEST_PHONE_STORE), 'Invalid store pause selection');
  assert(env.SGM_BLOCK_TEST_PHONE_INSTALLS === undefined || ['true', 'false'].includes(env.SGM_BLOCK_TEST_PHONE_INSTALLS));
  const blockInstallations = env.SGM_BLOCK_TEST_PHONE_INSTALLS === 'true';
  assert(!blockInstallations || env.SGM_PAUSE_TEST_PHONE_STORE === 'true', 'Installation guard also requires the approved store pause');
  const { serial, shell } = disposableAndroidShell(env, execute);
  const mapsRuntime = androidMapsPrerequisites(shell);
  assert.equal(shell('pm', 'path', launcher).startsWith('package:'), true, 'Expected Google APIs launcher missing');
  // This suite launches activities directly; exclude the independently crashing home app before execution.
  shell('pm', 'disable-user', '--user', '0', launcher);
  assert(shell('pm', 'list', 'packages', '-d', '--user', '0', launcher).split('\n')
    .includes(`package:${launcher}`), 'Launcher isolation was not applied');
  const storePause = env.SGM_PAUSE_TEST_PHONE_STORE === 'true' ? pauseDisposableStore(shell, { blockInstallations }) : null;
  return { serial, launcher, launcherDisabled: true, mapsRuntime, storePause, scope: 'disposable-emulator-without-home-navigation' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(configureDisposableAndroid()));
}
