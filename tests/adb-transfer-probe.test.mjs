import test from 'node:test';
import assert from 'node:assert/strict';
import { linkSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTransferProbe, transferTrialCount } from '../scripts/diagnostics/adb-transfer-probe.mjs';
import { summarizeTransferTrace } from '../scripts/diagnostics/adb-transfer-trace.mjs';

function fixture(t, { failAt = -1, corruptAt = -1, remoteExists = false, cleanupFails = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sgm-generated-transfer-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'result'), calls = [];
  let source, pulls = 0;
  const run = (adb, full, options) => {
    assert.equal(adb, '/sdk/platform-tools/adb'); assert.deepEqual(full.slice(0, 2), ['-s', 'emulator-5554']);
    assert.equal(options.timeout, 30000); assert.equal(options.maxBuffer, 8 * 1024 * 1024);
    const args = full.slice(2); calls.push(args);
    const done = (stdout = '') => ({ status: 0, signal: null, stdout, stderr: 'RAW-SECRET-NEVER-RETAIN' });
    if (args[0] === 'get-state') return done('device\n');
    if (args[1] === 'getprop') return done(args[2] === 'ro.kernel.qemu' ? '1\n' : '35\n');
    if (args[1] === 'pm') return done('');
    if (args[1] === 'test') return { ...done(), status: remoteExists ? 0 : 1 };
    if (args[0] === 'push') { source = args[1]; return done(); }
    if (args[0] === 'pull') {
      const index = pulls++;
      if (index === failAt) return { ...done(), status: 1, stderr: 'device offline RAW-SECRET-NEVER-RETAIN' };
      for (const name of readdirSync(source)) {
        if (index === corruptAt && name === 'generated-0.bin') writeFileSync(join(args[2], name), 'corrupt');
        else linkSync(join(source, name), join(args[2], name));
      }
      return done();
    }
    if (args[1] === 'rm') return { ...done(), status: cleanupFails ? 1 : 0 };
    assert.fail('Unexpected device command');
  };
  const options = { adb: '/sdk/platform-tools/adb', serial: 'emulator-5554', output, runId: 'a'.repeat(32) };
  const execute = () => runTransferProbe(options, { run,
    trace: () => ({ available: false, rawLogsRetained: false }), bytes: size => Buffer.alloc(size, 42) });
  return { calls, execute, output, options, run };
}

test('fixed independent transfers verify exact bytes without accepting a product flow or retaining logs', t => {
  const f = fixture(t), result = f.execute();
  assert.equal(result.success, true); assert.equal(result.trials.length, transferTrialCount);
  assert(result.trials.every(row => row.commandCompleted && row.integrityVerified));
  assert.equal(result.releaseAccepted, false); assert.equal(result.rootCauseConfirmed, false);
  assert.equal(result.retryPerformed, false); assert.equal(result.accountsUsed, false);
  assert.equal(result.cleanup.absenceVerified, true);
  assert.equal(f.calls.filter(args => args[0] === 'pull').length, 32);
  assert.equal(new Set(f.calls.filter(args => args[0] === 'pull').map(args => args[2])).size, 32);
  assert(readdirSync(f.output).every(name => name.endsWith('.json')));
  assert.doesNotMatch(JSON.stringify(result), /RAW-SECRET|stderr|stdout/);
  assert.deepEqual(JSON.parse(readFileSync(join(f.output, 'result.json'))), result);
  assert.throws(f.execute, /EEXIST/);
});

test('first command failure is immutable, stops the sequence and cannot be rescued by successful cleanup', t => {
  const f = fixture(t, { failAt: 2 }), result = f.execute();
  assert.equal(result.success, false); assert.equal(result.completed, false);
  assert.equal(result.trials.length, 3); assert.equal(result.trials[2].status, 1);
  assert.equal(result.cleanup.absenceVerified, true);
  assert.equal(f.calls.filter(args => args[0] === 'pull').length, 3);
  assert.equal(JSON.parse(readFileSync(join(f.output, 'trial-02.json'))).commandCompleted, false);
  assert.doesNotMatch(JSON.stringify(result), /RAW-SECRET/);
});

test('zero exit with missing or changed bytes fails integrity without another transfer', t => {
  const f = fixture(t, { corruptAt: 0 }), result = f.execute();
  assert.equal(result.success, false); assert.equal(result.trials.length, 1);
  assert.equal(result.trials[0].commandCompleted, true); assert.equal(result.trials[0].integrityVerified, false);
});

test('existing or unobservable remote paths are never overwritten or removed', t => {
  const f = fixture(t, { remoteExists: true }), result = f.execute();
  assert.equal(result.success, false); assert.equal(result.trials.length, 0);
  assert.equal(result.cleanup.remoteCreatedOrPartiallyCreated, false);
  assert(!f.calls.some(args => ['push', 'pull'].includes(args[0]) || args[1] === 'rm'));
});

test('cleanup failure prevents success even after all primary transfers pass', t => {
  const f = fixture(t, { cleanupFails: true }), result = f.execute();
  assert.equal(result.completed, true); assert.equal(result.success, false);
  assert.equal(result.cleanup.removed, false); assert.equal(result.cleanup.absenceVerified, false);
});

test('non-emulator selectors and unsafe identifiers fail before any command', t => {
  const f = fixture(t);
  for (const changes of [{ serial: 'personal-phone' }, { runId: '../other' }, { adb: 'adb' }, { output: 'relative' }])
    assert.throws(() => runTransferProbe({ ...f.options, ...changes }, { run: f.run }));
  assert.equal(f.calls.length, 0);
});

test('trace summaries retain only recognized transport failures, never payloads, commands or auth material', () => {
  const line = message => '10-28 12:40:23.636 3786 3846 D adb : transport.cpp:483 ' + message;
  const result = summarizeTransferTrace([
    line('remote local: read overflow (data length = 4294967295)'),
    line('emulator-5554: remote read: bad header'),
    line('remote local: terminated (data)'), line('remote local: read terminated (message)'),
    line('remote local: write terminated'), line('emulator-5554: connection terminated: read failed'),
    line('emulator-5554: connection terminated: write failed'),
    line('emulator-5554 from remote WRTE SECRET-PAYLOAD'),
    line('remote local: read overflow (data length = SECRET)'),
    '10-28 12:40:23.636 3786 3846 D adb : services.cpp:12 SECRET command',
    'Remote process closed the socket (on MSG_PEEK)',
  ].join('\n'));
  assert(Object.values(result.counts).every(count => count === 1));
  assert.equal(result.rawLogsRetained, false); assert.doesNotMatch(JSON.stringify(result), /SECRET|MSG_PEEK|5554/);
  assert.throws(() => summarizeTransferTrace('x'.repeat(4 * 1024 * 1024 + 1)));
});
