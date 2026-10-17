import test from 'node:test';
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { fetchLocalQa } from '../scripts/qa/local-http-request.mjs';

const block = () => execFileSync(process.execPath, ['-e', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400)']);
const request = { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer isolated-unit-token' }, body: '{}' };

test('one-shot local requests survive a native-style host pause without replaying a POST', async (t) => {
  const server = fork(new URL('./fixtures/local-idle-http-server.mjs', import.meta.url), { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  t.after(async () => { const exit = once(server, 'exit'); server.kill('SIGTERM'); await exit; });
  const [{ port }] = await once(server, 'message');
  const url = `http://127.0.0.1:${port}/sign-in`;
  const baseline = await fetch(url, request); await baseline.json(); await setImmediate();
  block();
  await assert.rejects(() => fetch(url, request), (error) => {
    assert(['UND_ERR_SOCKET', 'ECONNRESET'].includes(error.cause?.code), 'A closed baseline socket is required');
    return true;
  });
  const first = await (await fetchLocalQa(url, { ...request, headers: { ...request.headers, connection: 'keep-alive' } })).json();
  await setImmediate();
  block();
  const second = await (await fetchLocalQa(url, request)).json();
  assert.equal(first.connectionHeader, 'close'); assert.equal(second.connectionHeader, 'close');
  assert.notEqual(first.connection, second.connection);
  assert.equal(second.count, first.count + 1);
  assert.equal(second.authorization, 'Bearer isolated-unit-token');
  await assert.rejects(() => fetchLocalQa(url + '/drop', request), (error) => ['UND_ERR_SOCKET', 'ECONNRESET'].includes(error.cause?.code));
  const afterFailure = await (await fetchLocalQa(url, request)).json();
  assert.equal(afterFailure.count, second.count + 2, 'A failed POST must not be silently replayed');
});

test('the local-only request refuses external endpoints and cannot follow redirects', async () => {
  for (const url of ['https://127.0.0.1/', 'http://example.test/', 'https://example.test/']) {
    assert.throws(() => fetchLocalQa(url), /loopback HTTP endpoint/);
  }
  const source = readFileSync(new URL('../scripts/qa/local-http-request.mjs', import.meta.url), 'utf8');
  assert(source.includes("redirect: 'error'")); assert(!/retry|setTimeout/.test(source));
  const client = readFileSync(new URL('../scripts/qa/local-flow-client.mjs', import.meta.url), 'utf8');
  assert.equal((client.match(/await fetchLocalQa\(/g) ?? []).length, 2);
  assert(!client.includes('await fetch('));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    for (const path of ['tests/local-http-request.test.mjs', 'tests/fixtures/local-idle-http-server.mjs']) {
      assert.equal(workflow.split('"' + path + '"').length - 1, 2);
    }
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert(pkg.scripts['test:local-flow-isolation'].includes('tests/local-http-request.test.mjs'));
});
