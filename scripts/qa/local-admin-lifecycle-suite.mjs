import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { configureLocalEmulators } from './local-emulator-config.mjs';
import { superviseLocalProcess } from './supervised-local-process.mjs';

configureLocalEmulators();
const output = process.env.SGM_LOCAL_FLOW_OUTPUT;
assert(isAbsolute(output ?? '') && !existsSync(output));
const root = resolve(import.meta.dirname, '../..'), directory = dirname(output), cases = [];
async function runCase(mode) {
  const file = resolve(directory, 'admin-client-' + mode + '.json'), controller = new AbortController();
  let outcome, report, observation, failure;
  const running = superviseLocalProcess({ command: process.execPath, args: [resolve(root, 'tests/fixtures/local-admin-client.mjs'), mode, file],
    cwd: root, env: process.env, signal: controller.signal, stopGraceMs: 5_000 })
    .then(value => (outcome = { ok: true, value }), error => (outcome = { ok: false, error }));
  const timeout = setTimeout(() => controller.abort('SIGTERM'), 15_000);
  try {
    const deadline = Date.now() + 10_000;
    while (!existsSync(file)) {
      assert(!outcome, 'The real SDK client exited before its receipt');
      assert(Date.now() < deadline, 'The real SDK client did not finish its reads'); await delay(20);
    }
    report = JSON.parse(readFileSync(file)); assert.equal(report.mode, mode); assert.equal(report.readsCompleted, true);
    assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.runId, process.env.SGM_LOCAL_RUN_ID);
    assert.equal(report.productionWrites, false); assert.equal(report.forcedExitUsed, false);
    if (mode === 'before') {
      await delay(1_000); assert(!outcome, 'Omitted client cleanup must reproduce the live process');
      process.kill(report.processId, 0);
      controller.abort('SIGTERM'); const stopped = await running;
      assert(stopped.ok); assert.equal(stopped.value.stopped, true); assert.equal(stopped.value.signal, 'SIGTERM');
      assert.equal(report.registeredAppCount, 1); assert.equal(report.firestoreTerminationAcknowledged, false);
      assert.equal(report.appDeletionAcknowledged, false);
      observation = { incompleteClientCleanupReproduced: true, aliveAfterReceiptMs: 1000,
        intentionallyStopped: true, groupExitVerified: stopped.value.groupExitVerified };
    } else {
      const ended = await running; assert.equal(controller.signal.aborted, false, 'Natural exit must precede the deadline');
      assert.equal(report.registeredAppCount, 0); assert.equal(report.firestoreTerminationAcknowledged, true);
      assert.equal(report.appDeletionAcknowledged, true);
      assert.equal(report.taskErrorPreserved, mode === 'task-error');
      if (mode === 'after') { assert(ended.ok); assert.equal(ended.value.code, 0); assert.equal(ended.value.stopped, false); }
      else { assert.equal(ended.ok, false); assert.match(ended.error.message, /unsuccessfully/); }
      observation = { naturalExitObserved: true, successfulExit: mode === 'after', taskErrorPreserved: mode === 'task-error',
        groupExitVerified: ended.ok ? ended.value.groupExitVerified : ended.error.groupExitVerified };
    }
  } catch (error) { failure = error; }
  finally {
    clearTimeout(timeout); controller.abort('SIGTERM'); const ended = await running;
    try { assert.equal(ended.ok ? ended.value.groupExitVerified : ended.error.groupExitVerified, true); }
    catch (error) { failure = failure ? new AggregateError([failure, error], 'Trial and owned client cleanup failed') : error; }
  }
  if (failure) throw failure;
  return { mode, report, observation };
}
for (const mode of ['before', 'after', 'task-error']) cases.push(await runCase(mode));
const sources = ['scripts/qa/local-admin-lifecycle.mjs', 'scripts/qa/local-admin-lifecycle-suite.mjs',
  'scripts/qa/local-android-session.mjs', 'tests/fixtures/local-admin-client.mjs'];
writeFileSync(output, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
  testedAt: new Date().toISOString(), scope: 'isolated-real-admin-sdk-lifecycle-not-native-ui', completed: true,
  cases, productionWrites: false, physicalDeviceAccepted: false, nativeReplayAccepted: false, releaseComplete: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex')])) },
null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log('Real isolated SDK lifecycle: unclosed client reproduced; success and task-error clients exited naturally.');
