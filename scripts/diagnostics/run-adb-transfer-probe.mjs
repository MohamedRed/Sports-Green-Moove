import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { runTransferProbe } from './adb-transfer-probe.mjs';

assert.equal(process.platform, 'linux');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.RUNNER_OS, 'Linux');
assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
assert.equal(process.env.ADB_TRACE, 'transport');
assert(isAbsolute(process.env.ANDROID_HOME ?? ''));
const serial = process.env.ANDROID_SERIAL; assert.match(serial, /^emulator-\d+$/);
const versions = Object.fromEntries(['emulator', 'platform-tools'].map(name => {
  const properties = readFileSync(join(process.env.ANDROID_HOME, name, 'source.properties'), 'utf8');
  const version = /^Pkg.Revision\s*=\s*([\d.]+)\s*$/m.exec(properties)?.[1];
  assert(version, 'SDK package version is required for comparison'); return [name, version];
}));
const result = runTransferProbe({ adb: join(process.env.ANDROID_HOME, 'platform-tools/adb'), serial,
  output: resolve('android/app/build/outputs/transport-probe'), runId: randomBytes(16).toString('hex') });
writeFileSync(resolve('android/app/build/outputs/transport-probe/environment.json'), JSON.stringify({
  versions, nodeVersion: process.versions.node, apiLevel: 35, selectedRenderer: 'software',
  selectedProfile: 'pixel_6', scope: 'installed-tool-versions-and-selected-configuration-not-root-cause',
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(JSON.stringify({ completed: result.completed, trials: result.trials.length,
  success: result.success, releaseAccepted: false, rootCauseConfirmed: false }));
process.exitCode = result.success ? 0 : 1;
