import assert from 'node:assert/strict';
import {closeSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, readlinkSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import test from 'node:test';
import {inspectHostDnsConfiguration as inspect} from '../scripts/qa/host-dns-system-inputs.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-host-dns-files-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const allowed = new Set(['/etc/resolv.conf', '/run/systemd/resolve/stub-resolv.conf', '/run/systemd/resolve/resolv.conf']);
  const path = source => {assert(allowed.has(source)); return resolve(root, '.' + source);};
  const put = (source, value) => {mkdirSync(dirname(path(source)), {recursive: true}); writeFileSync(path(source), value, {mode: 0o600});};
  // Only fixture metadata models root ownership; all descriptors and bytes are real, owned temporary files.
  const owned = stat => ({...stat, uid: 0, isFile: () => stat.isFile(), isSymbolicLink: () => stat.isSymbolicLink()});
  const io = {lstatSync: source => owned(lstatSync(path(source))), readlinkSync: source => readlinkSync(path(source)),
    openSync: (source, flags) => openSync(path(source), flags), fstatSync: fd => owned(fstatSync(fd)), readSync, closeSync};
  put('/etc/resolv.conf', 'nameserver 127.0.0.53\nsearch PRIVATE_DOMAIN\n');
  return {path, put, io, options: {platform: 'linux', io, run: () => ({status: 0, stdout: 'active\n'})}};
}
test('bounded descriptor reads operate on real temporary files without reading the workstation resolver', t => {
  const f = fixture(t), result = inspect(f.options);
  assert.equal(result.primary.observed, true); assert.equal(result.primary.configuration.serverCount, 1);
  assert.equal(result.systemdUpstream.requested, false); assert(!JSON.stringify(result).includes('PRIVATE'));
});
test('a recognized fixture symlink reads the stub and separate upstream file without changing either', t => {
  const f = fixture(t); rmSync(f.path('/etc/resolv.conf'));
  symlinkSync('../run/systemd/resolve/stub-resolv.conf', f.path('/etc/resolv.conf'));
  f.put('/run/systemd/resolve/stub-resolv.conf', 'nameserver ::1\n');
  f.put('/run/systemd/resolve/resolv.conf', 'nameserver 192.0.2.3\n');
  const result = inspect(f.options); assert.equal(result.primary.layout, 'systemd-stub');
  assert.equal(result.primary.configuration.ipv6ServerCount, 1); assert.equal(result.systemdUpstream.observed, true);
  assert.equal(result.settingsChanged, false); assert(!JSON.stringify(result).includes('192.0.2.3'));
});
test('replacement by a symlink between inspection and open is refused by the real no-follow descriptor operation', t => {
  const f = fixture(t), open = f.io.openSync;
  f.io.openSync = (source, flags) => {rmSync(f.path(source)); symlinkSync('PRIVATE_TARGET', f.path(source)); return open(source, flags);};
  const result = inspect(f.options); assert.equal(result.primary.observed, false);
  assert.equal(result.systemdUpstream.requested, false); assert(!JSON.stringify(result).includes('PRIVATE'));
});
test('a real file changed during reading cannot retain an apparently valid snapshot', t => {
  const f = fixture(t); let changed = false;
  f.io.readSync = (...args) => {
    const count = readSync(...args);
    if (!changed) {changed = true; f.put('/etc/resolv.conf', 'nameserver 127.0.0.53\nsearch PRIVATE_LONGER_DOMAIN\n');}
    return count;
  };
  const result = inspect(f.options); assert.equal(result.primary.observed, false); assert.equal(result.primary.reason, 'changed-during-read');
  assert(!JSON.stringify(result).includes('PRIVATE'));
});
