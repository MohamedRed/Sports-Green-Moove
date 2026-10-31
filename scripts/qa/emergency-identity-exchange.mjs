import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

export async function runEmergencyIdentityExchange({ adb, serial, args, runId, onRecreate, onVerify }) {
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  const execute = promisify(execFile);
  let finished = false;
  const running = execute(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 8 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  const outcome = running.then((result) => ({ result }), (error) => ({ error })).finally(() => { finished = true; });
  try {
    for (const [step, response, action] of [['old-form-open', 'child-recreated', onRecreate],
      ['old-access-denied', 'parent-verified-again', onVerify]]) {
      const deadline = Date.now() + 150_000;
      let checkpoint;
      while (!checkpoint) {
        assert(!finished, 'Instrumentation ended before the required fixture checkpoint');
        assert(Date.now() < deadline, 'The fixture checkpoint did not arrive');
        const read = await execute(adb, ['-s', serial, 'shell',
          "run-as be.sportgreenmoove.app.local sh -c 'if test -f files/emergency-identity-request.json; then cat files/emergency-identity-request.json; fi'"],
        { encoding: 'utf8', timeout: 15_000 });
        if (read.stdout.trim()) {
          const value = JSON.parse(read.stdout); assert.equal(value.runId, runId);
          if (value.step === step) checkpoint = value;
          else assert.equal(value.step, 'old-form-open');
        }
        if (!checkpoint) await setTimeout(200);
      }
      await action();
      execFileSync(adb, ['-s', serial, 'shell', 'run-as', 'be.sportgreenmoove.app.local', 'dd',
        'of=files/emergency-identity-response.pending'], { input: JSON.stringify({ runId, step: response }),
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15_000 });
      execFileSync(adb, ['-s', serial, 'shell', 'run-as', 'be.sportgreenmoove.app.local', 'mv',
        'files/emergency-identity-response.pending', 'files/emergency-identity-response.json'], { timeout: 15_000, stdio: 'pipe' });
    }
    const value = await outcome; if (value.error) throw value.error; return value.result.stdout;
  } catch (error) {
    running.child?.kill('SIGTERM'); const completed = await outcome;
    error.stdout = completed.result?.stdout ?? completed.error?.stdout ?? '';
    throw error;
  }
}
