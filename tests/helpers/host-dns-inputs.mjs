import assert from 'node:assert/strict';
import {constants} from 'node:fs';

export function dnsInputsFixture(entries = {}) {
  const files = new Map(Object.entries({'/etc/resolv.conf': {body: 'nameserver 127.0.0.53\n'}, ...entries}));
  const calls = [], handles = new Map(); let next = 10;
  const missing = () => {throw Object.assign(new Error('PRIVATE_SECRET'), {code: 'ENOENT'});};
  const get = path => files.get(path) ?? missing();
  const metadata = file => ({uid: file.uid ?? 0, mode: file.mode ?? 0o644, size: file.size ?? Buffer.byteLength(file.body ?? ''),
    ino: 1, dev: 1, mtimeMs: 10, isFile: () => !file.directory, ...file.metadata});
  const io = {
    lstatSync(path) {calls.push(['lstat', path]); const file = get(path); return {...metadata(file), isSymbolicLink: () => !!file.link};},
    readlinkSync(path) {calls.push(['readlink', path]); return get(path).link;},
    openSync(path, flags) {
      calls.push(['open', path]); assert(flags & constants.O_NOFOLLOW); assert(flags & constants.O_NONBLOCK);
      assert.equal(flags & (constants.O_WRONLY | constants.O_RDWR), 0);
      const file = get(path); if (file.link) throw Object.assign(new Error('PRIVATE_SECRET'), {code: 'ELOOP'});
      const fd = next++; handles.set(fd, {path, file, offset: 0}); return fd;
    },
    fstatSync(fd) {const value = handles.get(fd); assert(value); calls.push(['fstat', value.path]); return metadata(value.file);},
    readSync(fd, buffer, offset, length, position) {
      assert.equal(position, null); const value = handles.get(fd); assert(value); calls.push(['read', value.path]);
      const body = Buffer.isBuffer(value.file.body) ? value.file.body : Buffer.from(value.file.body ?? '');
      const size = Math.min(length, body.length - value.offset); body.copy(buffer, offset, value.offset, value.offset + size);
      value.offset += size; return size;
    },
    closeSync(fd) {assert(handles.has(fd)); calls.push(['close', handles.get(fd).path]); handles.delete(fd);},
  };
  const run = (command, args, options) => {
    calls.push(['service', command]); assert.equal(command, '/usr/bin/systemctl');
    assert.deepEqual(args, ['is-active', 'systemd-resolved.service']);
    assert.deepEqual(options.env, {PATH: '/usr/bin:/bin', LC_ALL: 'C'});
    assert.equal(options.timeout, 2000); assert.equal(options.maxBuffer, 4096);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']); return {status: 0, stdout: 'active\n'};
  };
  return {files, calls, handles, io, run, options: {platform: 'linux', io, run}};
}
