import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {createServer} from 'node:https';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('firebase-tools/package.json'));
const {Agent} = cliRequire('undici');
const {mode} = JSON.parse(readFileSync(0, 'utf8'));
assert(['allow', 'deny', 'untrusted'].includes(mode));
const directory = mkdtempSync(resolve(tmpdir(), 'sgm-synthetic-tls-'));
let agent, server, port;
let verifierCalls = 0, requestsReceived = 0;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
    '-keyout', resolve(directory, 'key.pem'), '-out', resolve(directory, 'cert.pem')], {stdio: 'ignore', timeout: 5000});
  const certificate = readFileSync(resolve(directory, 'cert.pem'), 'utf8');
  server = createServer({key: readFileSync(resolve(directory, 'key.pem')), cert: certificate}, (_, response) => {
    requestsReceived++; response.end('synthetic-response');
  });
  await new Promise((done, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', done);});
  port = server.address().port;
  agent = new Agent({
    tls: {ca: mode === 'untrusted' ? [] : certificate, checkServerIdentity: (hostname, cert) => {
      assert.equal(hostname, 'localhost'); assert.equal(cert.subject.CN, 'localhost'); verifierCalls++;
      if (mode === 'deny') return Object.assign(new Error('Synthetic custom certificate rejection'), {code: 'SGM_QA_CERT_REJECTED'});
    }},
    connect: {lookup: (_, options, callback) => callback(null, ...(options.all
      ? [[{address: '127.0.0.1', family: 4}]] : ['127.0.0.1', 4]))},
  });
  let result;
  try {
    const response = await agent.request({origin: `https://localhost:${port}`, path: '/', method: 'GET',
      headersTimeout: 2000, bodyTimeout: 2000});
    result = {status: response.statusCode, body: await response.body.text(), errorCode: null};
  } catch (error) {result = {status: null, body: null, errorCode: error.code};}
  await agent.destroy(); agent = undefined;
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done())); server = undefined;
  const {connect} = await import('node:net');
  const closed = await new Promise(done => {
    const socket = connect({host: '127.0.0.1', port});
    socket.once('connect', () => {socket.destroy(); done(false);});
    socket.once('error', error => done(error.code === 'ECONNREFUSED'));
    socket.setTimeout(1000, () => {socket.destroy(); done(false);});
  });
  assert(closed, 'Synthetic TLS endpoint must be closed');
  console.log(JSON.stringify({...result, verifierCalls, requestsReceived, endpointClosed: closed, externalRequests: 0}));
} finally {
  await agent?.destroy();
  if (server) {server.closeAllConnections(); await new Promise(done => server.close(done));}
  rmSync(directory, {recursive: true, force: true});
}
