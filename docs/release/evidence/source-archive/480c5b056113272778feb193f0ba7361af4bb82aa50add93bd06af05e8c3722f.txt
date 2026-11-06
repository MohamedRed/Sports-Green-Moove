import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {waitForDisposableWifi} from '../scripts/qa/wait-disposable-wifi.mjs';

const root = resolve(import.meta.dirname, '..');
function entry(t, readinessStatus) {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-matrix-precondition-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  mkdirSync(resolve(temp, 'scripts')); mkdirSync(resolve(temp, 'bin'));
  cpSync(resolve(root, 'scripts/run-android-ui-tests-and-collect-screenshots.sh'), resolve(temp, 'scripts/run.sh'));
  writeFileSync(resolve(temp, 'bin/node'), `#!/bin/sh
name="\${1##*/}"
printf '%s\\n' "$name" >> "$QA_CALLS"
case "$name" in
  observe-network-bootstrap.mjs) exit 0 ;;
  wait-disposable-wifi.mjs) exit "$QA_WIFI_STATUS" ;;
  configure-continuous-disposable.mjs) exit 73 ;;
  *) exit 91 ;;
esac
`, {mode: 0o700});
  const result = spawnSync('/bin/bash', [resolve(temp, 'scripts/run.sh')], {cwd: temp, encoding: 'utf8', timeout: 5000,
    env: {PATH: resolve(temp, 'bin') + ':/usr/bin:/bin', HOME: temp,
      QA_CALLS: resolve(temp, 'calls'), QA_WIFI_STATUS: String(readinessStatus)}});
  assert.ifError(result.error); assert.equal(result.signal, null);
  return {status: result.status, calls: readFileSync(resolve(temp, 'calls'), 'utf8').trim().split('\n')};
}
test('the actual full-matrix entry stops on an unmet Wi-Fi prerequisite before any app installation', t => {
  const result = entry(t, 41);
  assert.equal(result.status, 1, 'The matrix preserves its existing nonzero prerequisite exit');
  assert.deepEqual(result.calls, ['observe-network-bootstrap.mjs', 'wait-disposable-wifi.mjs']);
});
test('the actual full-matrix entry proceeds to installation only after the same Wi-Fi prerequisite succeeds', t => {
  const result = entry(t, 0);
  assert.equal(result.status, 1, 'The controlled installer must stop this host-only probe through the existing wrapper');
  assert.deepEqual(result.calls, ['observe-network-bootstrap.mjs', 'wait-disposable-wifi.mjs', 'configure-continuous-disposable.mjs']);
});
test('the existing passive readiness helper accepts the disposable full matrix before entering device inspection', async () => {
  const expected = new Error('Controlled device boundary; no device command executed'); let entered = false;
  await assert.rejects(waitForDisposableWifi('/private/unused-readiness', {
    SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_FOCUSED_UI_CASE: 'full-matrix',
  }, {exists: () => false, deviceFactory: () => {entered = true; throw expected;}}), error => error === expected);
  assert.equal(entered, true);
});
test('other cases and non-disposable contexts cannot use the full-matrix prerequisite', async () => {
  for (const env of [{}, {SGM_LOCAL_DISPOSABLE_EMULATOR: 'true', SGM_FOCUSED_UI_CASE: 'other-case'},
    {SGM_LOCAL_DISPOSABLE_EMULATOR: 'false', SGM_FOCUSED_UI_CASE: 'full-matrix'}]) {
    let entered = false;
    await assert.rejects(waitForDisposableWifi('/private/unused-readiness', env,
      {exists: () => false, deviceFactory: () => {entered = true; throw new Error('Unexpected device inspection');}}));
    assert.equal(entered, false);
  }
});
