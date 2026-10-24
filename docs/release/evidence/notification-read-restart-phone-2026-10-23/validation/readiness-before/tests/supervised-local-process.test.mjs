import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { superviseLocalProcess } from '../scripts/qa/supervised-local-process.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const fixture = fileURLToPath(new URL('./fixtures/supervised-service.mjs', import.meta.url));
const run = (mode, signal, readyPath, command = process.execPath) => superviseLocalProcess({ command,
  args: [fixture, mode, readyPath], env: process.env, signal, stopGraceMs: 5_000 });
async function waitForFile(file) {
  const deadline = Date.now() + 5_000;
  while (!existsSync(file)) { assert(Date.now() < deadline, 'Fixture did not become ready'); await delay(20); }
  return JSON.parse(readFileSync(file));
}
for (const signal of ['SIGINT', 'SIGTERM']) test(`${signal} stops the owned launcher and worker before acknowledging shutdown`, async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-supervision-')), ready = resolve(directory, 'ready.json');
  const controller = new AbortController(); let ids;
  const running = run('service', controller.signal, ready);
  try {
    ids = await waitForFile(ready); controller.abort(signal);
    const result = await running; assert.equal(result.stopped, true); assert.equal(result.groupExitVerified, true);
    for (const pid of [ids.launcher, ids.worker]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { controller.abort(signal); await running; rmSync(directory, { recursive: true, force: true }); }
});
test('normal success and nonzero failure remain different outcomes', async () => {
  const result = await run('success', new AbortController().signal);
  assert.equal(result.code, 0); assert.equal(result.stopped, false);
  await assert.rejects(run('failure', new AbortController().signal), error => {
    assert.match(error.message, /unsuccessfully/); assert.equal(error.groupExitVerified, true); return true;
  });
});
test('a spawn error is surfaced rather than accepted as an intentional stop', async () => {
  await assert.rejects(run('success', new AbortController().signal, undefined, '/missing-sgm-supervised-service'), error => {
    assert.equal(error.code, 'ENOENT'); assert.notEqual(error.groupExitVerified, true); return true;
  });
});
test('a stop requested before startup never spawns a service', async () => {
  const controller = new AbortController(); controller.abort('SIGTERM');
  assert.deepEqual(await run('service', controller.signal), { stopped: true, spawned: false, groupExitVerified: true });
});
test('an actual service failure cannot be converted to success by a simultaneous shutdown request', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-supervision-')), ready = resolve(directory, 'ready.json');
  const controller = new AbortController(), running = run('failure-on-stop', controller.signal, ready);
  try {
    await waitForFile(ready); controller.abort('SIGTERM'); await assert.rejects(running, /unsuccessfully/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('a launcher that exits while leaving its worker fails even after explicit owned-group cleanup', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-supervision-')), ready = resolve(directory, 'ready.json');
  try {
    await assert.rejects(run('orphan', new AbortController().signal, ready), /live descendants/);
    const ids = await waitForFile(ready);
    for (const pid of [ids.launcher, ids.worker]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('both original actual emulator shutdowns removed their private sessions and released every isolated port', () => {
  const root = fileURLToPath(new URL('../', import.meta.url)), base = resolve(root, 'docs/release/evidence/local-ui-shutdown-2026-10-19');
  const report = JSON.parse(readFileSync(resolve(base, 'services.json')));
  assert.equal(report.scope, 'actual-isolated-service-shutdown-not-phone-or-release-proof');
  assert.equal(report.completed, true); assert.equal(report.productionWrites, false);
  assert.equal(report.checks.length, 2); assertRetainedSourceFiles(root, report.sourceFiles);
  report.checks.forEach((check, index) => {
    assert.equal(check.signal, ['SIGINT', 'SIGTERM'][index]); assert.equal(check.exitCode, [130, 143][index]);
    assert.equal(check.supervisorExitedAfterCleanup, true); assert.equal(check.privateSessionFileRemoved, true);
    assert.deepEqual(check.loopbackPortsRefused, [5001, 8080, 9000, 9099]);
    assert.deepEqual(check.servicesStopped, ['Authentication', 'Database', 'Firestore', 'Functions']);
  });
  for (const [file, expected] of Object.entries(JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')))))
    assert.equal(createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex'), expected);
});
