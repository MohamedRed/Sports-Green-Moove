import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { selectEmulatorHost, observeEmulatorHost, createFreshHostObservationDirectory } from './emulator-host-observation.mjs';
import { focusedCases } from './preinstalled-disposable-apks.mjs';
import { matrixCases } from './android-case-apks.mjs';

const [mode, phase] = process.argv.slice(2), env = process.env;
assert(['start', 'observe', 'wait'].includes(mode) && [...focusedCases, ...matrixCases].includes(phase));
assert.equal(process.platform, 'linux'); assert.equal(env.GITHUB_ACTIONS, 'true'); assert.equal(env.RUNNER_OS, 'Linux');
assert.equal(env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
const root = resolve(import.meta.dirname, '../..');
const directory = resolve(root, 'android/app/build/outputs/focused-safety-ui', phase, 'host-shutdown');
const path = name => resolve(directory, name + '.json');
const save = (name, row) => writeFile(path(name), JSON.stringify(row, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
const scope = 'ci-read-only-emulator-host-observation-not-flow-or-root-cause-proof';

if (mode === 'start') {
  const port = Number(env.EMULATOR_PORT);
  assert.equal(env.ANDROID_SERIAL, `emulator-${port}`);
  assert.equal(env.SGM_FOCUSED_UI_CASE, phase);
  const identity = await selectEmulatorHost({ port, avd: 'test' });
  await createFreshHostObservationDirectory(directory);
  await save('started', { scope, phase, startedAt: new Date().toISOString(), identity,
    maximumObservationMs: 90_000, rawArgumentsRetained: false, environmentRetained: false, deviceCommandsRequested: false });
  const childEnv = Object.fromEntries(['GITHUB_ACTIONS', 'RUNNER_OS', 'SGM_LOCAL_DISPOSABLE_EMULATOR']
    .map(key => [key, env[key]]));
  const child = spawn(process.execPath, [resolve(import.meta.filename), 'observe', phase],
    { env: childEnv, detached: true, stdio: 'ignore', cwd: root });
  await new Promise((ready, reject) => { child.once('spawn', ready); child.once('error', reject); });
  child.unref();
  console.log('Read-only CI host observation started; no shutdown or flow success is implied.');
} else if (mode === 'observe') {
  const binding = JSON.parse(await readFile(path('started'), 'utf8'));
  assert.equal(binding.scope, scope); assert.equal(binding.phase, phase);
  const observation = await observeEmulatorHost(binding.identity,
    { onSample: (row, index) => save('sample-' + index, row) });
  await save('complete', { scope, phase, completedAt: new Date().toISOString(), ...observation,
    targetExitObserved: observation.finalState === 'gone',
    processSignalsRequested: false, deviceCommandsRequested: false, flowAccepted: false, rootCauseConfirmed: false });
} else {
  const deadline = performance.now() + 95_000;
  let available = false;
  while (performance.now() <= deadline) {
    try {
      const result = JSON.parse(await readFile(path('complete'), 'utf8'));
      assert.equal(result.scope, scope); assert.equal(result.phase, phase);
      assert(['gone', 'present', 'zombie', 'identity-changed', 'unavailable'].includes(result.finalState));
      console.log('CI host observation: ' + result.finalState + ' (diagnostic only).'); available = true; break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try { await readFile(path('started')); } catch { break; }
      await delay(500);
    }
  }
  if (!available) console.log('CI host observation unavailable; original test and cleanup outcomes remain unchanged.');
}
