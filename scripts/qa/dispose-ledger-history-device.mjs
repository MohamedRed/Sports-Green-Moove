import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const output = process.argv[2]; assert(output?.startsWith('/') && !existsSync(output));
assert.equal(process.platform, 'darwin');
const sdk = process.env.ANDROID_HOME; assert(sdk?.startsWith('/'));
const adb = resolve(sdk, 'platform-tools/adb'), serial = 'emulator-5580', name = 'sgm_ledger_history_20261024';
const run = (command, args) => execFileSync(command, args, {encoding: 'utf8', timeout: 60_000}).trim();
assert.equal(run(adb, ['-s', serial, 'shell', 'getprop', 'ro.kernel.qemu']), '1');
assert.equal(run(adb, ['-s', serial, 'emu', 'avd', 'name']).split(/\r?\n/)[0], name);
assert.equal(run(adb, ['-s', serial, 'shell', 'pm', 'list', 'packages', 'be.sportgreenmoove.app.local']), '');
const pids = run('/usr/sbin/lsof', ['-t', '-iTCP:5580', '-sTCP:LISTEN']).split(/\r?\n/);
assert.equal(pids.length, 1); assert.match(pids[0], /^\d+$/);
const pid = Number(pids[0]); assert.match(run('/bin/ps', ['-p', String(pid), '-o', 'comm=']), /qemu-system-aarch64/);
assert.match(run(adb, ['-s', serial, 'emu', 'kill']), /OK/);
const gone = () => { try { process.kill(pid, 0); return false; } catch (error) { if (error.code !== 'ESRCH') throw error; return true; } };
const absent = () => !run(adb, ['devices']).split(/\r?\n/).some(line => line.startsWith(serial + '\t'));
const deadline = Date.now() + 45_000;
while ((!gone() || !absent()) && Date.now() < deadline) await delay(250);
assert(gone()); assert(absent());
run(resolve(sdk, 'cmdline-tools/latest/bin/avdmanager'), ['delete', 'avd', '-n', name]);
const paths = ['.android/avd/' + name + '.ini', '.android/avd/' + name + '.avd'].map(file => resolve(homedir(), file));
assert(paths.every(path => !existsSync(path)));
for (const port of [5580, 5581, 5001, 8080, 9000, 9099]) {
  const result = spawnSync('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8', timeout: 10_000});
  assert.equal(result.status, 1); assert.equal(result.stdout.trim(), '');
}
writeFileSync(output, JSON.stringify({scope: 'owned-local-ledger-device-disposal-not-release-proof',
  checkedAt: new Date().toISOString(), avdName: name, serial,
  localPackagesAbsent: true, consoleStopAcknowledged: true, hostExited: true,
  deviceAbsent: true, avdDeleted: true, portsClosed: true, temporaryAdministrationUsed: false}, null, 2) + '\n', {flag: 'wx'});
console.log('Only the owned ledger test device was stopped and deleted; packages, host and ports verified.');
