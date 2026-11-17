import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const adminEntry = functionsRequire.resolve('firebase-admin');
const worker = fileURLToPath(new URL('./helpers/multipart-security-probe.mjs', import.meta.url));
const boundary = 'sgm-isolated-security-boundary';
const part = (header, value) => `--${boundary}\r\n${header}\r\n\r\n${value}\r\n`;
function probe(mode, body, selectedBoundary = boundary) {
  // A malformed search must not block the parent test process or other suites.
  const child = spawnSync(process.execPath, [worker], {
    input: JSON.stringify({ adminEntry, mode, body, boundary: selectedBoundary }),
    encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test('the Admin-resolved multipart parser preserves normal fields and files', () => {
  const result = probe('busboy', part('Content-Disposition: form-data; name="note"', 'test only')
    + part('Content-Disposition: form-data; name="upload"; filename="qa.txt"', 'synthetic file')
    + `--${boundary}--\r\n`);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.fields, [{ name: 'note', value: 'test only' }]);
  assert.deepEqual(result.files, [{ name: 'upload', filename: 'qa.txt', body: 'synthetic file' }]);
});

for (const header of ['__proto__', 'constructor']) {
  test(`the Admin-resolved Dicer accepts a ${header} part header without a parser crash`, () => {
    const result = probe('dicer', part(`${header}: untrusted\r\nContent-Type: application/http`, 'synthetic response')
      + `--${boundary}--\r\n`);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.parts, ['synthetic response']);
  });
}

for (const size of [70, 251, 252]) {
  test(`the Admin-resolved Dicer completes a ${size}-byte boundary without blocking`, () => {
    const selectedBoundary = 'b'.repeat(size);
    const result = probe('dicer', 'x'.repeat(1024) + `\r\n--${selectedBoundary}\r\nContent-Type: text/plain\r\n\r\n`
      + 'x'.repeat(1024) + `\r\n--${selectedBoundary}--\r\n`, selectedBoundary);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.parts, ['x'.repeat(1024)]);
  });
}

for (const [label, control] of [['CR', '\r'], ['LF', '\n']]) {
  for (const target of ['name', 'filename']) {
    test(`the Admin-resolved parser never delivers bare ${label} in a multipart ${target}`, () => {
      const disposition = target === 'name'
        ? `Content-Disposition: form-data; name="bad${control}name"`
        : `Content-Disposition: form-data; name="upload"; filename="bad${control}file.txt"`;
      const result = probe('busboy', part(disposition, 'synthetic') + `--${boundary}--\r\n`);
      for (const item of [...result.fields, ...result.files]) {
        assert.doesNotMatch(item.name, /[\r\n]/);
        if (item.filename !== undefined) assert.doesNotMatch(item.filename, /[\r\n]/);
      }
    });
  }
}
