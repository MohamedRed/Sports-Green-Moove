import assert from 'node:assert/strict';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {inspectHostDnsConfiguration} from './host-dns-system-inputs.mjs';

export function observeHostDnsBeforeLaunch(selectedCase, env = process.env, {
  platform = process.platform, root = resolve(import.meta.dirname, '../..'), exists = existsSync,
  mkdir = mkdirSync, write = writeFileSync, inspect = inspectHostDnsConfiguration,
} = {}) {
  assert(platform === 'linux' && env.GITHUB_ACTIONS === 'true' && env.RUNNER_OS === 'Linux', 'An existing Linux CI host is required');
  assert(env.SGM_LOCAL_DISPOSABLE_EMULATOR === 'true', 'Disposable test context is required');
  assert(['full-matrix', 'chat-network-recovery'].includes(selectedCase), 'Select one existing disposable network case');
  const directory = resolve(root, 'android/app/build/outputs', selectedCase === 'full-matrix' ? 'store-review-screenshots' :
    'focused-safety-ui/chat-network-recovery');
  const path = resolve(directory, 'host-dns-before-launch.json'); assert(!exists(path), 'Refuse to repeat or replace a host observation');
  mkdir(directory, {recursive: true, mode: 0o700});
  const observation = inspect();
  const report = {scope: 'passive-host-resolver-configuration-before-launch-not-resolution-or-flow-proof',
    selectedCase, recordedAt: new Date().toISOString(), observation,
    deviceCommandsRequested: false, rawLogsRetained: false, addressesRetained: false,
    newPhoneStarted: false, flowAccepted: false, releaseAccepted: false};
  write(path, JSON.stringify(report, null, 2) + '\n', {mode: 0o600, flag: 'wx'}); return report;
}
if (process.argv[1] === import.meta.filename) {
  assert.equal(process.argv.length, 3); observeHostDnsBeforeLaunch(process.argv[2]);
  console.log('Passive host resolver metadata saved; no query, settings change, phone or flow acceptance.');
}
