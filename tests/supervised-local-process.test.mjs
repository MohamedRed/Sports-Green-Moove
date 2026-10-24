import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
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
async function waitForExistence(file) {
  const deadline = Date.now() + 5_000;
  while (!existsSync(file)) { assert(Date.now() < deadline, 'Fixture did not become ready'); await delay(20); }
}
async function waitForFile(file) { await waitForExistence(file); return JSON.parse(readFileSync(file)); }
async function withFixture(mode, check, stopSignal = 'SIGTERM') {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-supervision-')), ready = resolve(directory, 'ready.json');
  const controller = new AbortController(), running = run(mode, controller.signal, ready);
  try { return await check({ directory, ready, controller, running }); }
  finally {
    controller.abort(stopSignal);
    const outcome = await running.then(result => result, error => error);
    assert.equal(outcome.groupExitVerified, true, 'Fixture cleanup must finish even when readiness validation fails');
    rmSync(directory, { recursive: true, force: true });
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) test(`${signal} stops the owned launcher and worker before acknowledging shutdown`, async () => {
  await withFixture('service', async ({ ready, controller, running }) => {
    const ids = await waitForFile(ready); controller.abort(signal);
    const result = await running; assert.equal(result.stopped, true); assert.equal(result.groupExitVerified, true);
    for (const pid of [ids.launcher, ids.worker]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  }, signal);
});
test('readiness stays unpublished while its temporary JSON is incomplete', async () => {
  await withFixture('blocked-publication', async ({ ready }) => {
    await waitForExistence(ready + '.pending');
    assert.equal(readFileSync(ready + '.pending', 'utf8'), ''); assert.equal(existsSync(ready), false);
    writeFileSync(ready + '.publish', 'publish');
    const ids = await waitForFile(ready);
    assert(Number.isSafeInteger(ids.launcher) && ids.launcher > 0);
    assert(Number.isSafeInteger(ids.worker) && ids.worker > 0); assert.equal(existsSync(ready + '.pending'), false);
  });
});
test('a readiness-consumer failure still closes the owned launcher and worker', async () => {
  let ids;
  await assert.rejects(withFixture('service', async ({ ready }) => {
    ids = await waitForFile(ready); throw new Error('Rejected readiness receipt');
  }), /Rejected readiness receipt/);
  for (const pid of [ids.launcher, ids.worker]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
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
  await withFixture('failure-on-stop', async ({ ready, controller, running }) => {
    await waitForFile(ready); controller.abort('SIGTERM'); await assert.rejects(running, /unsuccessfully/);
  });
});
test('a launcher that exits while leaving its worker fails even after explicit owned-group cleanup', async () => {
  await withFixture('orphan', async ({ ready, running }) => {
    await assert.rejects(running, /live descendants/);
    const ids = await waitForFile(ready);
    for (const pid of [ids.launcher, ids.worker]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
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
