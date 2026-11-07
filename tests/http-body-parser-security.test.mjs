import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const runtimeRequire = createRequire(functionsRequire.resolve('firebase-functions'));
const expressRequire = createRequire(runtimeRequire.resolve('express'));
const parser = expressRequire('body-parser');
const worker = fileURLToPath(new URL('./helpers/http-body-parser-probe.mjs', import.meta.url));
const probe = mode => {
  const child = spawnSync(process.execPath, [worker], {input: JSON.stringify({mode}),
    encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024});
  assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
};

test('the Functions-resolved JSON parser rejects invalid size-limit configuration', () => {
  for (const limit of ['invalid', '', NaN, true, false, {}])
    assert.throws(() => parser.json({limit}), /option limit .* is invalid/);
});
for (const mode of ['json', 'gzip']) test(`the Functions-resolved parser preserves valid ${mode} requests`, () => {
  assert.deepEqual(probe(mode), {status: 200, body: {synthetic: true}});
});
test('the production parser enforces the decoded size limit for compressed requests', () => {
  assert.deepEqual(probe('over-limit'), {status: 413, type: 'entity.too.large'});
});
test('the production parser rejects malformed JSON through its normal error path', () => {
  assert.deepEqual(probe('invalid-json'), {status: 400, type: 'entity.parse.failed'});
});
test('trailing compressed bytes cannot leave downstream request completion hanging', () => {
  assert.deepEqual(probe('trailing'), {status: 200, body: {synthetic: true}});
});
test('trailing compressed bytes do not crash or detach an independent raw-body consumer', () => {
  const result = probe('trailing-with-consumer');
  assert.equal(result.status, 200); assert.deepEqual(result.body, {synthetic: true});
  assert.match(result.rawSha256, /^[a-f0-9]{64}$/); assert.equal(result.rawSha256, result.expectedRawSha256);
});
test('gzip trailing bytes cannot crash the worker after a successful response', () => {
  assert.deepEqual(probe('gzip-trailing'), {status: 200, body: {synthetic: true}});
});
test('a rejected compressed charset cannot leave an unhandled decoder error', () => {
  assert.deepEqual(probe('gzip-unsupported-charset'), {status: 415, type: 'charset.unsupported'});
});
