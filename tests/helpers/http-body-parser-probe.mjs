import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer, request} from 'node:http';
import {createHash} from 'node:crypto';
import {deflateSync, gzipSync} from 'node:zlib';

const input = JSON.parse(await new Promise(resolve => {
  let text = ''; process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {text += chunk; assert(text.length < 4096);});
  process.stdin.on('end', () => resolve(text));
}));
const functionsRequire = createRequire(new URL('../../functions/package.json', import.meta.url));
const runtimeRequire = createRequire(functionsRequire.resolve('firebase-functions'));
const expressRequire = createRequire(runtimeRequire.resolve('express'));
const lateGzip = ['gzip-trailing', 'gzip-unsupported-charset'].includes(input.mode);
const parser = expressRequire('body-parser').json({limit: 64,
  ...(input.mode === 'gzip-unsupported-charset' ? {verify: () => {}} : {})});
assert(['json', 'gzip', 'over-limit', 'invalid-json', 'trailing', 'trailing-with-consumer',
  'gzip-trailing', 'gzip-unsupported-charset'].includes(input.mode));
const trailing = input.mode.startsWith('trailing');
const plain = JSON.stringify(input.mode === 'over-limit' ? {text: 'x'.repeat(128)} : {synthetic: true});
const first = lateGzip ? Buffer.concat([gzipSync(plain), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]) :
  trailing ? Buffer.concat([deflateSync(plain), Buffer.from([0])]) :
  input.mode === 'invalid-json' ? Buffer.from('{invalid') :
    ['gzip', 'over-limit'].includes(input.mode) ? gzipSync(plain) : Buffer.from(plain);
const tail = trailing ? Buffer.alloc(256) : Buffer.alloc(0);
let outgoing, rawHash;
const server = createServer((incoming, response) => {
  if (input.mode === 'trailing-with-consumer') {
    rawHash = createHash('sha256'); incoming.pipe(rawHash);
  }
  parser(incoming, response, error => {
    if (error) {
      response.writeHead(error.status ?? 500, {'content-type': 'application/json'});
      response.end(JSON.stringify({type: error.type})); return;
    }
    const reply = () => {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({body: incoming.body,
        ...(rawHash ? {rawSha256: rawHash.read().toString('hex')} : {})}));
    };
    if (!trailing) {reply(); return;}
    // The second chunk is released only after decoding the complete first frame.
    if (rawHash) rawHash.once('finish', reply);
    else incoming.once('end', reply);
    outgoing.end(tail);
  });
});
await new Promise((resolve, reject) => {
  server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
});
try {
  const result = await new Promise((resolve, reject) => {
    outgoing = request({hostname: '127.0.0.1', port: server.address().port, path: '/', method: 'POST', agent: false,
      headers: {'content-type': input.mode === 'gzip-unsupported-charset' ? 'application/json; charset=utf-999' : 'application/json',
        'content-length': first.length + tail.length,
        ...(trailing ? {'content-encoding': 'deflate'} :
          lateGzip || ['gzip', 'over-limit'].includes(input.mode) ? {'content-encoding': 'gzip'} : {})}}, incoming => {
      let body = ''; incoming.setEncoding('utf8');
      incoming.on('data', chunk => {body += chunk; assert(body.length < 4096);});
      incoming.on('error', reject);
      incoming.on('end', () => {
        try {resolve({status: incoming.statusCode, ...JSON.parse(body)});} catch (error) {reject(error);}
      });
    });
    outgoing.on('error', reject);
    outgoing.setTimeout(2000, () => outgoing.destroy(new Error('Isolated parser probe did not finish')));
    if (trailing) outgoing.write(first); else outgoing.end(first);
  });
  // Keep the process alive for errors emitted after the response has completed.
  if (lateGzip) await new Promise(resolve => setTimeout(resolve, 200));
  if (rawHash) result.expectedRawSha256 = createHash('sha256').update(first).update(tail).digest('hex');
  console.log(JSON.stringify(result));
} finally {
  outgoing?.destroy();
  await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
}
