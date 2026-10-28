import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { readTransferTrace } from './adb-transfer-trace.mjs';

export const transferTrialCount = 32;
export const fixtureSizes = [147456, 1048576, 4194304];
const digest = value => createHash('sha256').update(value).digest('hex');
const commandOutcome = result => ({ status: Number.isInteger(result.status) ? result.status : null,
  signal: result.signal ?? null, errorCode: result.error ? 'COMMAND_ERROR' : null });
const completed = row => row.status === 0 && row.signal === null && row.errorCode === null;
const missing = row => row.status === 1 && row.signal === null && row.errorCode === null;

export function runTransferProbe({ adb, serial, output, runId }, {
  run = spawnSync, trace = readTransferTrace, bytes = randomBytes,
} = {}) {
  assert(isAbsolute(adb) && isAbsolute(output)); assert.match(serial, /^emulator-\d+$/);
  assert.match(runId, /^[a-f0-9]{32}$/);
  mkdirSync(output, { mode: 0o700 });
  const save = (name, value) => writeFileSync(join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n',
    { mode: 0o600, flag: 'wx' });
  const remote = '/data/local/tmp/sgm-transfer-probe-' + runId;
  const source = join(output, 'generated-input');
  const command = args => run(adb, ['-s', serial, ...args], {
    encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const check = (stage, args) => {
    report.stage = stage;
    const result = command(args);
    report.lastPreparationCommand = commandOutcome(result);
    assert(completed(report.lastPreparationCommand), 'Probe preparation command failed; raw output withheld');
    return result.stdout?.trim();
  };
  const report = { scope: 'isolated-generated-file-transfer-not-user-flow-or-release-proof', runId,
    startedAt: new Date().toISOString(), plannedTrials: transferTrialCount, trials: [],
    completed: false, stage: 'preparation', appInstalled: false, accountsUsed: false,
    retryPerformed: false, alternateTransportUsed: false, rootCauseConfirmed: false, releaseAccepted: false };
  save('started', report);
  let remoteOwned = false, failure = null;
  try {
    assert.equal(check('target-state', ['get-state']), 'device');
    assert.equal(check('emulator-identity', ['shell', 'getprop', 'ro.kernel.qemu']), '1');
    assert.equal(check('api-level', ['shell', 'getprop', 'ro.build.version.sdk']), '35');
    for (const name of ['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local'])
      assert.equal(check('product-app-absence', ['shell', 'pm', 'list', 'packages', name]), '', 'Probe requires no product app');
    report.stage = 'fresh-remote-path';
    const absent = commandOutcome(command(['shell', 'test', '-e', remote]));
    assert(missing(absent), 'Refuse an existing or unobservable remote path');
    report.stage = 'generate-fixtures'; mkdirSync(source, { mode: 0o700 });
    report.fixtures = fixtureSizes.map((size, index) => {
      const name = `generated-${index}.bin`, value = bytes(size);
      assert.equal(value.length, size);
      writeFileSync(join(source, name), value, { mode: 0o600, flag: 'wx' });
      return { name, size, sha256: digest(value) };
    });
    remoteOwned = true;
    check('push-generated-files', ['push', source, remote]);
    report.stage = 'transfers'; report.traceBefore = trace();
    for (let index = 0; index < transferTrialCount; index++) {
      const name = `trial-${String(index).padStart(2, '0')}`, destination = join(output, name);
      mkdirSync(destination, { mode: 0o700 });
      const startedAt = new Date().toISOString(), start = performance.now();
      const outcome = commandOutcome(command(['pull', remote + '/.', destination]));
      const row = { index, startedAt, elapsedMs: Math.round(performance.now() - start), ...outcome,
        commandCompleted: completed(outcome), integrityVerified: false };
      try {
        if (row.commandCompleted) {
          assert.deepEqual(readdirSync(destination).sort(), report.fixtures.map(file => file.name));
          for (const file of report.fixtures) {
            const value = readFileSync(join(destination, file.name));
            assert.equal(value.length, file.size); assert.equal(digest(value), file.sha256);
          }
          row.integrityVerified = true;
        }
      } catch { row.integrityVerified = false; }
      report.trials.push(row); save(name, row);
      rmSync(destination, { recursive: true });
      assert(row.commandCompleted && row.integrityVerified, 'Single primary transfer failed; no retry performed');
    }
    report.completed = true;
  } catch { failure = true; }
  finally {
    report.traceAfter = trace();
    report.cleanup = { remoteCreatedOrPartiallyCreated: remoteOwned, removed: false, absenceVerified: false };
    if (remoteOwned) {
      const removal = commandOutcome(command(['shell', 'rm', '-rf', remote]));
      report.cleanup.removed = completed(removal);
      report.cleanup.absenceVerified = report.cleanup.removed &&
        missing(commandOutcome(command(['shell', 'test', '-e', remote])));
    }
    rmSync(source, { recursive: true, force: true });
    report.finishedAt = new Date().toISOString();
    report.success = !failure && report.completed && report.cleanup.absenceVerified;
    save('result', report);
  }
  return report;
}
