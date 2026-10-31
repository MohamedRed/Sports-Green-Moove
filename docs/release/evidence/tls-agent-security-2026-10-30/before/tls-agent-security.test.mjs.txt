import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const worker = fileURLToPath(new URL('./helpers/tls-agent-probe.mjs', import.meta.url));
const probe = mode => {
  const child = spawnSync(process.execPath, ['--max-old-space-size=64', worker], {
    input: JSON.stringify({mode}), encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 32 * 1024,
    env: {PATH: process.env.PATH, TMPDIR: process.env.TMPDIR},
  });
  assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
};
test('the CLI-resolved TLS agent invokes custom verification before allowing a trusted certificate', () => {
  assert.deepEqual(probe('allow'), {status: 200, body: 'synthetic-response', errorCode: null,
    verifierCalls: 1, requestsReceived: 1, endpointClosed: true, externalRequests: 0});
});
test('custom rejection blocks an otherwise trusted certificate before sending an HTTP request', () => {
  assert.deepEqual(probe('deny'), {status: null, body: null, errorCode: 'SGM_QA_CERT_REJECTED',
    verifierCalls: 1, requestsReceived: 0, endpointClosed: true, externalRequests: 0});
});
test('an untrusted certificate remains blocked independently of custom verification', () => {
  assert.deepEqual(probe('untrusted'), {status: null, body: null, errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    verifierCalls: 0, requestsReceived: 0, endpointClosed: true, externalRequests: 0});
});
