import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';

const worker = resolve(import.meta.dirname, 'helpers/protocol-query-security-probe.mjs');
function probe(mode, variant) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-isolated-parser-'));
  try {
    const child = spawnSync(process.execPath, ['--max-old-space-size=64', worker], {
      input: JSON.stringify({mode, variant, directory}), encoding: 'utf8', timeout: 3000,
      killSignal: 'SIGKILL', maxBuffer: 32 * 1024, env: {PATH: process.env.PATH, TMPDIR: process.env.TMPDIR},
    });
    const rows = child.stdout.trim().split('\n').filter(Boolean).map(row => JSON.parse(row));
    assert.equal(rows[0]?.ready, true, 'The actual installed consumer must load before testing parser behavior');
    assert.equal(rows[0].networkGuardActive, true);
    assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
    assert.equal(rows.length, 2); const result = rows[1];
    assert.equal(result.finished, true); assert.equal(result.networkAttempts, 0); return result;
  } finally {rmSync(directory, {recursive: true, force: true});}
}
for (const variant of ['parse', 'load', 'loadSync']) test('the actual protocol parser rejects an unfinished option through ' + variant, () => {
  const row = probe('proto-malformed', variant);
  assert.equal(row.actualConsumer, 'firebase-admin/firestore/google-gax/proto-loader/protobufjs');
  assert.equal(row.result.rejected, true); assert.equal(row.result.expectedSyntaxError, true);
});
for (const variant of ['parse', 'load', 'loadSync', 'wire']) test('ordinary ride data retains its actual protocol round trip through ' + variant, () => {
  assert.equal(probe('proto-normal', variant).result.normalWireRoundTrip, true);
});
test('the actual payment query utility handles a noncallable buffer marker as ordinary data', () => {
  const row = probe('query-malformed', 'stripe-buffer'); assert.equal(row.actualConsumer, 'stripe/qs');
  assert.equal(row.result.hostileValuePreservedAsData, true);
});
for (const variant of ['comma', 'comma-encoded']) test('the payment-resolved query encoder safely coerces a noncallable string property: ' + variant, () => {
  assert.equal(probe('query-malformed', variant).result.safelyCoerced, true);
});
for (const variant of ['v1', 'v2']) test('ordinary payment parameter serialization remains unchanged: ' + variant, () => {
  assert.equal(probe('query-normal', variant).result.expectedShape, true);
});
