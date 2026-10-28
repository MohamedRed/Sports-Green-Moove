import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const worker = fileURLToPath(new URL('./helpers/dependency-security-probe.mjs', import.meta.url));
const probe = input => {
  const child = spawnSync(process.execPath, ['--max-old-space-size=64', worker], {input: JSON.stringify(input),
    encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024});
  assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
};

for (const variant of ['root', 'cli']) for (const size of ['field', 'filename'])
  test(`installed ${variant} multipart encoder escapes hostile ${size} metadata`, () => {
    assert.deepEqual(probe({mode: 'multipart', variant, size}), {injectedHeader: false, valuePreserved: true});
  });
for (const variant of ['secure', 'nonsecure', 'customRandom']) for (const size of [0, -1, 8])
  test(`build-resolved ${variant} ID generator terminates with size ${size}`, () => {
    assert.deepEqual(probe({mode: 'id', variant, size}), {length: Math.max(size, 0), validAlphabet: true});
  });
for (const variant of ['large', 'fractional', 'nested'])
  test(`build-resolved source map rejects ${variant} offsets before expanding lines`, () => {
    assert.deepEqual(probe({mode: 'source-offset', variant}), {rejected: true, expectedError: true});
  });
test('ordinary source-map sections are still accepted', () => {
  assert.deepEqual(probe({mode: 'source-offset', variant: 'normal'}), {rejected: false});
});
test('untrusted CSS cannot read an arbitrary synthetic map when from is omitted', () => {
  assert.deepEqual(probe({mode: 'source-map-read'}), {cssPreserved: true, syntheticFileExposed: false});
});
