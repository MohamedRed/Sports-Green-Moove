import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { assertLocalEndpointsClosed } from '../scripts/qa/local-emulator-lifecycle.mjs';

test('endpoint disposal proof rejects a live listener and succeeds only after its closure', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try { await assert.rejects(assertLocalEndpointsClosed([port]), { code: 'EADDRINUSE' }); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  assert.deepEqual(await assertLocalEndpointsClosed([port]), { host: '127.0.0.1', ports: [port], closed: true });
});
test('endpoint disposal proof refuses ambiguous or invalid port inventories', async () => {
  for (const ports of [[], [0], [65536], [8080, 8080], [1.5]]) await assert.rejects(assertLocalEndpointsClosed(ports));
});
