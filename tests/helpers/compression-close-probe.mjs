import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer, get} from 'node:http';
import {createServer as createListener} from 'node:net';
import {once} from 'node:events';
import zlib from 'node:zlib';

let input = '';
for await (const chunk of process.stdin) { input += chunk; assert(input.length <= 1024); }
const {mode, encoding} = JSON.parse(input);
assert(['abort', 'normal'].includes(mode)); assert(['gzip', 'deflate', 'br', 'identity'].includes(encoding));
assert(mode !== 'abort' || encoding !== 'identity');
const require = createRequire(import.meta.url), cli = createRequire(require.resolve('firebase-tools/package.json'));
const hosting = createRequire(cli.resolve('superstatic/package.json')), compression = hosting('compression');
const factories = ['createGzip', 'createDeflate', 'createBrotliCompress'], originals = new Map(), streams = [];
let closeEvents = 0, received = 0, premature = false, bodyVerified = null, result;
for (const name of factories) {
  const descriptor = Object.getOwnPropertyDescriptor(zlib, name); originals.set(name, descriptor);
  Object.defineProperty(zlib, name, {...descriptor, value: (...args) => {
    const stream = descriptor.value(...args); streams.push(stream); stream.once('close', () => { closeEvents++; }); return stream;
  }});
}
const payload = Buffer.from('isolated-compression-check-'.repeat(4096));
const middleware = compression({threshold: 0});
let observeResponseClose;
const responseClosed = new Promise(resolve => { observeResponseClose = resolve; });
const server = createServer((request, response) => {
  received++;
  response.once('close', () => { premature = !response.writableEnded; observeResponseClose(); });
  middleware(request, response, () => {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (mode === 'normal') response.end(payload);
    else { response.write(payload); response.flush(); }
  });
});
let endpointClosed = false, port, timer, request;
try {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); port = server.address().port;
  await new Promise((resolve, reject) => {
    request = get({host: '127.0.0.1', port, path: '/', agent: false, headers: {'Accept-Encoding': encoding}}, response => {
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['content-encoding'] ?? 'identity', encoding);
      if (mode === 'abort') {
        response.once('data', () => { response.destroy(); request.destroy(); resolve(); });
        response.once('error', reject);
      } else {
        const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.once('error', reject);
        response.once('end', () => {
          try {
            const bytes = Buffer.concat(chunks), decode = {gzip: zlib.gunzipSync, deflate: zlib.inflateSync, br: zlib.brotliDecompressSync};
            assert.deepEqual(encoding === 'identity' ? bytes : decode[encoding](bytes), payload); bodyVerified = true; resolve();
          } catch (error) {reject(error);}
        });
      }
    });
    request.once('error', reject);
  });
  await responseClosed;
  await Promise.race([
    Promise.all(streams.map(stream => stream.closed ? undefined : once(stream, 'close'))),
    new Promise(resolve => { timer = setTimeout(resolve, 1000); }),
  ]);
  clearTimeout(timer);
  result = {mode, encoding, requestsReceived: received, responsePrematurelyClosed: premature,
    streamsCreated: streams.length, streamsDestroyed: streams.every(stream => stream.destroyed),
    streamCloseEvents: closeEvents, bodyVerified, endpointClosed: false, externalRequests: 0};
} finally {
  clearTimeout(timer); request?.destroy(); for (const stream of streams) stream.destroy();
  if (server.listening) { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; }
  for (const [name, descriptor] of originals) Object.defineProperty(zlib, name, descriptor);
  if (port !== undefined) {
    const check = createListener(); check.listen({host: '127.0.0.1', port, exclusive: true}); await once(check, 'listening');
    const closed = once(check, 'close'); check.close(); await closed; endpointClosed = true;
  }
}
assert(result && endpointClosed); result.endpointClosed = true; console.log(JSON.stringify(result));
