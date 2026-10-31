import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const worker = fileURLToPath(new URL('./helpers/compression-close-probe.mjs', import.meta.url));
function probe(mode, encoding) {
  const child = spawnSync(process.execPath, ['--max-old-space-size=64', worker], {input: JSON.stringify({mode, encoding}),
    encoding: 'utf8', timeout: 6000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024,
    env: {PATH: process.env.PATH, TMPDIR: process.env.TMPDIR}});
  assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}
for (const encoding of ['gzip', 'deflate', 'br']) {
  test('the CLI-resolved ' + encoding + ' stream closes when the client aborts a real response', () => {
    assert.deepEqual(probe('abort', encoding), {mode: 'abort', encoding, requestsReceived: 1,
      responsePrematurelyClosed: true, streamsCreated: 1, streamsDestroyed: true, streamCloseEvents: 1,
      bodyVerified: null, endpointClosed: true, externalRequests: 0});
  });
  test('normal ' + encoding + ' responses preserve every payload byte and close their stream', () => {
    assert.deepEqual(probe('normal', encoding), {mode: 'normal', encoding, requestsReceived: 1,
      responsePrematurelyClosed: false, streamsCreated: 1, streamsDestroyed: true, streamCloseEvents: 1,
      bodyVerified: true, endpointClosed: true, externalRequests: 0});
  });
}
test('identity responses stay uncompressed and preserve every byte', () => {
  assert.deepEqual(probe('normal', 'identity'), {mode: 'normal', encoding: 'identity', requestsReceived: 1,
    responsePrematurelyClosed: false, streamsCreated: 0, streamsDestroyed: true, streamCloseEvents: 0,
    bodyVerified: true, endpointClosed: true, externalRequests: 0});
});
