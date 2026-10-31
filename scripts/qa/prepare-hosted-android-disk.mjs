import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, lstatSync, mkdirSync, realpathSync, statfsSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const emulatorDiskReserveBytes = 11 * 1024 ** 3;
export const unusedHostedDotnet = '/usr/share/dotnet';

export function prepareHostedAndroidDisk({env = process.env, platform = process.platform,
  available = path => {const value = statfsSync(path); return value.bavail * value.bsize;},
  exists = existsSync, inspect = lstatSync, realpath = realpathSync,
  remove = path => execFileSync('sudo', ['rm', '-rf', '--', path], {stdio: 'pipe'})} = {}) {
  assert.equal(platform, 'linux'); assert.equal(env.CI, 'true'); assert.equal(env.GITHUB_ACTIONS, 'true');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted'); assert.equal(env.RUNNER_OS, 'Linux');
  assert.equal(env.GITHUB_JOB, 'android-native-ui');
  assert(typeof env.GITHUB_WORKSPACE === 'string' && env.GITHUB_WORKSPACE.startsWith('/home/runner/work/'));
  const workspace = realpath(env.GITHUB_WORKSPACE);
  assert(workspace.startsWith('/home/runner/work/')); assert(!workspace.startsWith(unusedHostedDotnet + '/'));
  const space = () => {const value = available(workspace); assert(Number.isSafeInteger(value) && value >= 0); return value;};
  const result = {scope: 'hosted-runner-capacity-not-device-or-test-proof', observedAt: new Date().toISOString(),
    requiredBytes: emulatorDiskReserveBytes, beforeBytes: space(), afterBytes: null,
    removedUnusedDotnet: false, deviceStorageReduced: false, testScopeReduced: false, ready: false};
  if (result.beforeBytes < emulatorDiskReserveBytes && exists(unusedHostedDotnet)) {
    const info = inspect(unusedHostedDotnet);
    assert(info.isDirectory() && !info.isSymbolicLink(), 'Only the unused hosted .NET directory may be removed');
    assert.equal(realpath(unusedHostedDotnet), unusedHostedDotnet);
    remove(unusedHostedDotnet); result.removedUnusedDotnet = true;
    assert(!exists(unusedHostedDotnet), 'Unused tool removal must be verified');
  }
  result.afterBytes = space(); result.ready = result.afterBytes >= emulatorDiskReserveBytes;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, 'No cleanup paths or capacity overrides are accepted');
  const result = prepareHostedAndroidDisk();
  const output = resolve(process.env.GITHUB_WORKSPACE, 'android/app/build/outputs/host-disk-capacity.json');
  mkdirSync(resolve(output, '..'), {recursive: true}); writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify(result));
  assert(result.ready, 'Insufficient hosted capacity: do not start or shrink the emulator');
}
