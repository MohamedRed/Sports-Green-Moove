import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectHostDnsConfiguration as inspect} from '../scripts/qa/host-dns-system-inputs.mjs';
import {dnsInputsFixture} from './helpers/host-dns-inputs.mjs';

test('a regular primary configuration is read once and never replaced by systemd upstream data', () => {
  const f = dnsInputsFixture(), result = inspect(f.options);
  assert.equal(result.primary.observed, true); assert.equal(result.primary.layout, 'regular');
  assert.equal(result.primary.configuration.loopbackServerCount, 1);
  assert.equal(result.systemdUpstream.requested, false); assert.equal(result.resolvedService.state, 'active');
  assert.deepEqual(f.calls.filter(row => row[0] === 'open'), [['open', '/etc/resolv.conf']]);
  assert.equal(f.handles.size, 0);
  for (const key of ['atomicObservation', 'dnsQueriesIssued', 'networkRequestsIssued', 'settingsChanged', 'serviceChanged',
    'exactEmulatorDnsBindingVerified', 'rootCauseConfirmed']) assert.equal(result[key], false);
});
test('known systemd stub links get independent upstream categories, not forwarding or resolution acceptance', () => {
  const f = dnsInputsFixture({'/etc/resolv.conf': {link: '../run/systemd/resolve/stub-resolv.conf'},
    '/run/systemd/resolve/stub-resolv.conf': {body: 'nameserver 127.0.0.53\nsearch PRIVATE_DOMAIN'},
    '/run/systemd/resolve/resolv.conf': {body: 'nameserver 192.0.2.77\n'}});
  const result = inspect(f.options); assert.equal(result.primary.layout, 'systemd-stub');
  assert.equal(result.primary.configuration.loopbackServerCount, 1);
  assert.equal(result.systemdUpstream.observed, true); assert.equal(result.systemdUpstream.configuration.loopbackServerCount, 0);
  assert.equal(result.exactEmulatorDnsBindingVerified, false); assert.equal(f.handles.size, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|127\.|192\./);
});
test('missing, invalid or untrusted primary data cannot switch to another resolver file', () => {
  for (const entry of [null, {body: 'nameserver PRIVATE_SECRET'}, {body: 'nameserver 127.0.0.1', uid: 99},
    {link: '/private/SECRET'}, {body: 'x'.repeat(65537)}, {body: Buffer.from([0xff])},
    {body: 'nameserver 127.0.0.1', mode: 0o666}, {body: 'nameserver 127.0.0.1', directory: true}]) {
    const f = dnsInputsFixture(); if (entry === null) f.files.delete('/etc/resolv.conf'); else f.files.set('/etc/resolv.conf', entry);
    const result = inspect(f.options); assert.equal(result.primary.observed, false); assert.equal(result.systemdUpstream.requested, false);
    assert.equal(f.handles.size, 0); assert(!f.calls.some(row => row[1].includes('/private/')));
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET|127\.|192\./);
  }
});
test('an unsupported nested symlink and unavailable upstream remain unobserved without follow-up reads', () => {
  const f = dnsInputsFixture({'/etc/resolv.conf': {link: '/run/systemd/resolve/stub-resolv.conf'},
    '/run/systemd/resolve/stub-resolv.conf': {body: 'nameserver 127.0.0.53'}});
  const result = inspect(f.options); assert.equal(result.primary.observed, true);
  assert.equal(result.systemdUpstream.observed, false); assert.equal(result.systemdUpstream.reason, 'not-found');
  assert.equal(f.handles.size, 0);
  f.files.set('/run/systemd/resolve/resolv.conf', {link: '/private/SECRET'});
  const second = inspect(f.options); assert.equal(second.systemdUpstream.reason, 'unsupported-link');
  assert(!f.calls.some(row => row[1].includes('/private/')));
});
test('file changes during a bounded read invalidate the snapshot and never expose its contents', () => {
  const f = dnsInputsFixture(); let samples = 0;
  const readStat = f.io.fstatSync; f.io.fstatSync = fd => ({...readStat(fd), mtimeMs: samples++ ? 11 : 10});
  const result = inspect(f.options); assert.equal(result.primary.observed, false); assert.equal(result.primary.reason, 'changed-during-read');
  assert.equal(f.handles.size, 0); assert(!JSON.stringify(result).includes('127.'));
});
test('an oversized read is bounded even when the initial file size is inaccurate', () => {
  const f = dnsInputsFixture({'/etc/resolv.conf': {body: 'x'.repeat(70000), size: 0}});
  const result = inspect(f.options); assert.equal(result.primary.reason, 'oversized'); assert.equal(f.handles.size, 0);
  assert.equal(f.calls.filter(row => row[0] === 'read').length, 1);
});
test('non-regular primary entries are refused before opening and a close error cannot retain an observed configuration', () => {
  const f = dnsInputsFixture({'/etc/resolv.conf': {directory: true}}), first = inspect(f.options);
  assert.equal(first.primary.reason, 'not-regular'); assert(!f.calls.some(row => row[0] === 'open'));
  const second = dnsInputsFixture(), close = second.io.closeSync;
  second.io.closeSync = fd => {close(fd); throw new Error('PRIVATE_SECRET');};
  const result = inspect(second.options); assert.equal(result.primary.observed, false); assert.equal(result.primary.reason, 'close-unavailable');
  assert.equal(second.handles.size, 0); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET/);
});
test('service errors and unknown states have only bounded categorical output, never raw stdout, errors or environments', () => {
  for (const run of [() => {throw new Error('PRIVATE_SECRET');}, () => ({status: 3, stdout: 'PRIVATE_SECRET', stderr: 'PRIVATE_SECRET'}),
    () => ({status: null, signal: 'SIGTERM', stdout: 'PRIVATE_SECRET'}),
    () => ({error: {code: 'ETIMEDOUT', message: 'PRIVATE_SECRET'}})]) {
    const f = dnsInputsFixture(), result = inspect({...f.options, run});
    assert.equal(result.resolvedService.observed, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET/);
  }
  const f = dnsInputsFixture(), result = inspect({...f.options, run: () => ({status: 3, stdout: 'inactive\n'})});
  assert.deepEqual(result.resolvedService, {requested: true, observed: true, state: 'inactive', exitStatus: 3});
});
test('unsupported hosts perform no filesystem, service or network observation', () => {
  const f = dnsInputsFixture(), result = inspect({...f.options, platform: 'darwin'});
  assert.deepEqual(result, {supported: false, reason: 'unsupported-host'}); assert.deepEqual(f.calls, []);
});
