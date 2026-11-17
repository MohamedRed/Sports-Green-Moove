import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const firestoreRequire = createRequire(require.resolve('@google-cloud/firestore'));
const gax = firestoreRequire('google-gax');
const { FirestoreClient } = require('@google-cloud/firestore').v1;

async function runQuery(errors, statusAware = true) {
  const client = new FirestoreClient({ projectId: 'demo-sgm-local-qa', gaxServerStreamingRetries: statusAware });
  const caller = client.descriptors.stream.runQuery.getApiCaller();
  const stream = caller.init();
  const data = [];
  const completion = new Promise((resolve) => {
    stream.on('data', (value) => data.push(value));
    stream.on('error', (error) => resolve({ code: error.code, data }));
    stream.on('end', () => resolve({ data }));
  });
  let calls = 0;
  const requests = [];
  const request = (argument) => {
    requests.push(argument);
    const response = new PassThrough({ objectMode: true }), error = errors[calls++];
    response.cancel = () => response.destroy();
    process.nextTick(() => {
      if (error !== undefined) response.destroy(Object.assign(new Error('Synthetic transport status'), { code: error }));
      else {
        response.end({ document: 'synthetic-local-result' });
        response.emit('status', { code: 0, details: '' });
      }
    });
    return response;
  };
  caller.call(request, {}, {
    retryRequestOptions: { noResponseRetries: 1 },
    retry: new gax.RetryOptions([4, 8, 13, 14], {
      ...gax.createDefaultBackoffSettings(), initialRetryDelayMillis: 1,
      maxRetryDelayMillis: 1, totalTimeoutMillis: 1000,
    }),
  }, stream);
  return { ...await completion, calls, sameRequest: requests.every((request) => request === requests[0]) };
}

test('the installed query transport otherwise retries ABORTED with the same request', async () => {
  const result = await runQuery([10, 3], false);
  assert.equal(result.calls, 2);
  assert.equal(result.code, 3);
  assert.equal(result.sameRequest, true);
});

for (const code of [10, 3, 7, 5]) test(`status-aware transport returns ${code} without replaying the RPC`, async () => {
  const result = await runQuery([code]);
  assert.equal(result.calls, 1);
  assert.equal(result.code, code);
});

test('configured transient status handling still permits a bounded UNAVAILABLE retry', async () => {
  const result = await runQuery([14]);
  assert.equal(result.calls, 2);
  assert.equal(result.code, undefined);
  assert.deepEqual(result.data, [{ document: 'synthetic-local-result' }]);
});

test('the shared client enables this installed transport policy without alternative providers or extra transaction retries', () => {
  const source = readFileSync(new URL('../functions/src/lib/firestore.ts', import.meta.url), 'utf8');
  assert.match(source, /firestore\.settings\(\{ gaxServerStreamingRetries: true \}\)/);
  assert(!/maxAttempts|preferRest|catch\s*\(/.test(source));
});
