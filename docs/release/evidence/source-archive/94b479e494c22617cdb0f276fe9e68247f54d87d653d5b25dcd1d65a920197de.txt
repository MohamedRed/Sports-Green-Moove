import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {constants, lstatSync} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertPrivatePipe} from './read-private-credential-pipe.mjs';
import {credentialFormCsp, privateCredentialFormPage} from './private-credential-form-page.mjs';

const validKey = key => typeof key === 'string' && key.length >= 16 && Buffer.byteLength(key) <= 256 && !/[\x00-\x20\x7f]/.test(key);
export async function deliverPrivateCredential(pipe, key) {
  assertPrivatePipe(pipe);
  assert(validKey(key), 'Invalid private input');
  const before = lstatSync(pipe), bytes = Buffer.from(key + '\n');
  let handle;
  try {
    handle = await open(pipe, constants.O_WRONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    const current = await handle.stat();
    assert(current.isFIFO() && current.ino === before.ino && current.dev === before.dev);
    assert.equal(current.uid, process.getuid()); assert.equal(current.mode & 0o777, 0o600);
    const result = await handle.write(bytes); assert.equal(result.bytesWritten, bytes.length);
  } finally {bytes.fill(0); await handle?.close();}
}

export async function startPrivateCredentialForm(pipe, {deliver = deliverPrivateCredential, deadlineMs = 180_000} = {}) {
  assert(isAbsolute(pipe)); assertPrivatePipe(pipe);
  assert(Number.isInteger(deadlineMs) && deadlineMs >= 100 && deadlineMs <= 180_000);
  let consumed = false, finished = false, timer, origin;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('Content-Security-Policy', credentialFormCsp);
    response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body = '') => {response.writeHead(status, {'Content-Type': 'text/plain; charset=utf-8'}); response.end(body);};
    if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== new URL(origin).host) return reply(403);
    if (request.method === 'GET' && request.url === '/') {
      response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return response.end(privateCredentialFormPage);
    }
    if (request.method === 'GET' && request.url === '/favicon.ico') return reply(204);
    if (request.method !== 'POST' || request.url !== '/handoff') return reply(404);
    if (request.headers.origin !== origin || request.headers['sec-fetch-site'] !== 'same-origin' ||
      request.headers['x-sgm-qa-input'] !== '1' || request.headers['content-type'] !== 'application/json') return reply(403);
    if (consumed || finished) return reply(409);
    const chunks = []; let length = 0, invalid = false;
    request.on('data', chunk => {
      length += chunk.length;
      if (length > 1024) {invalid = true; chunks.splice(0).forEach(value => value.fill(0));}
      else if (!invalid) chunks.push(chunk);
    });
    request.on('error', () => {chunks.splice(0).forEach(value => value.fill(0));});
    request.on('end', async () => {
      let key, data;
      try {
        if (invalid) return reply(413);
        data = Buffer.concat(chunks); const body = JSON.parse(data.toString());
        if (Object.keys(body).length !== 1 || !validKey(body.accessKey)) return reply(400);
        if (consumed || finished) return reply(409);
        consumed = true; key = body.accessKey; body.accessKey = '';
        await deliver(pipe, key); key = ''; reply(204); stop(false);
      } catch {reply(400); if (consumed) stop(false);}
      finally {key = ''; data?.fill(0); chunks.splice(0).forEach(value => value.fill(0));}
    });
  });
  server.headersTimeout = 10_000; server.requestTimeout = 10_000; server.maxRequestsPerSocket = 2;
  const closed = new Promise(resolveClosed => server.once('close', resolveClosed));
  const stop = (force = true) => {
    if (!finished) {finished = true; clearTimeout(timer); server.close(); server.closeIdleConnections();}
    if (force) server.closeAllConnections();
  };
  await new Promise((resolveReady, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', () => {server.removeListener('error', reject); resolveReady();});
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  timer = setTimeout(stop, deadlineMs);
  return {origin, closed, stop};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let form;
  const stop = () => form?.stop();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    assert.equal(process.argv.length, 3);
    form = await startPrivateCredentialForm(process.argv[2]);
    console.log(JSON.stringify({scope: 'one-use-loopback-credential-input-not-provider-connection-proof', origin: form.origin}));
    await form.closed;
    console.log('Private input listener closed; no credential persisted.');
  } catch {console.error('Private input preparation did not complete.'); process.exitCode = 1;}
  finally {form?.stop(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);}
}
