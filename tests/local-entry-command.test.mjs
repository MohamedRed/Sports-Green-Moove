import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { localEntryCommand } from '../scripts/qa/local-entry-command.mjs';
import { emulatorEntryArguments } from '../scripts/qa/local-runtime.mjs';

const fixture = fileURLToPath(new URL('./fixtures/signal-entry.mjs', import.meta.url));
for (const signal of ['SIGINT', 'SIGTERM']) test(`${signal} reaches the entry directly through the actual POSIX shell`, async () => {
  const child = spawn(localEntryCommand(process.execPath, fixture), { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(child, 'close', { signal: AbortSignal.timeout(10_000) });
  try {
    const [chunk] = await Promise.race([once(child.stdout, 'data', { signal: AbortSignal.timeout(5_000) }),
      closed.then(() => { throw new Error('Entry exited before readiness'); })]);
    assert.equal(Number(chunk.toString().trim()), child.pid, 'A separate waiting shell must not remain');
    assert(child.kill(signal));
    assert.deepEqual(await closed, [0, null]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await closed; }
  }
});
test('shell metacharacters in an entry path remain literal rather than becoming commands', () => {
  assert.equal(localEntryCommand('/tmp/node with space', "/tmp/test's $HOME `id` ;.mjs"),
    "exec '/tmp/node with space' '/tmp/test'\\''s $HOME `id` ;.mjs'");
  for (const value of ['', null, '/tmp/entry\0.mjs']) assert.throws(() => localEntryCommand('/tmp/node', value));
});
test('the real emulator launcher uses the shell-replacing command without loosening exit checks', () => {
  const args = emulatorEntryArguments({ temp: '/tmp/sgm-entry-contract' }, 'local-ui-session.mjs');
  assert.equal(args.at(-1), localEntryCommand(process.execPath, fileURLToPath(new URL('../scripts/qa/local-ui-session.mjs', import.meta.url))));
  assert(args.includes('emulators:exec'));
});
test('the corrected actual shutdown keeps both signals and the original remote refusal in their own scopes', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const base = resolve(root, 'docs/release/evidence/local-ui-shell-shutdown-2026-10-19');
  const read = (file) => readFileSync(resolve(base, file));
  const report = JSON.parse(read('services.json'));
  assert.equal(report.scope, 'actual-isolated-service-shutdown-not-phone-or-release-proof');
  assert.equal(report.completed, true); assert.equal(report.productionWrites, false);
  assert.deepEqual(report.checks.map(({ signal, exitCode }) => [signal, exitCode]), [['SIGINT', 130], ['SIGTERM', 143]]);
  for (const check of report.checks) {
    assert.equal(check.supervisorExitedAfterCleanup, true); assert.equal(check.privateSessionFileRemoved, true);
    assert.deepEqual(check.loopbackPortsRefused, [5001, 8080, 9000, 9099]);
    assert.deepEqual(check.servicesStopped, ['Authentication', 'Database', 'Firestore', 'Functions']);
  }
  assertRetainedSourceFiles(root, report.sourceFiles);
  for (const [file, expected] of Object.entries(JSON.parse(read('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected, file);
  assert(read('before-web-failure.txt').toString().includes('Script exited with signal: SIGINT'));
  assert(read('before-web-failure.txt').toString().includes('1 !== 130'));
  const device = JSON.parse(read('before-device-setup.json'));
  assert.equal(device.scope, 'failed-disposable-device-setup-not-flow-proof');
  assert.equal(device.adminCleanup, null); assert.equal(device.storeCleanup.verified, false);
});
