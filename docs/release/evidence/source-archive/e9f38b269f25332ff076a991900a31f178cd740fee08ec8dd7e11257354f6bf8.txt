import assert from 'node:assert/strict';
import { createServer } from 'node:net';

export async function assertLocalEndpointsClosed(ports) {
  assert(Array.isArray(ports) && ports.length > 0);
  assert.equal(new Set(ports).size, ports.length);
  for (const port of ports) {
    assert(Number.isInteger(port) && port > 0 && port < 65536);
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close((error) => error ? reject(error) : resolve()));
    });
  }
  return { host: '127.0.0.1', ports: [...ports], closed: true };
}
