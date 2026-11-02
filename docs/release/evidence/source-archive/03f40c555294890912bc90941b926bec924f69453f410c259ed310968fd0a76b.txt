import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {lstatSync, readFileSync} from 'node:fs';
import {dirname, isAbsolute, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const revealScript = `document.querySelector('button').addEventListener('click',()=>{const input=document.querySelector('input');
input.type=input.type==='password'?'text':'password';document.querySelector('button').textContent=input.type==='password'?'Afficher':'Masquer';});`;
const revealHash = createHash('sha256').update(revealScript).digest('base64');

export function readPrivateFixturePassword(path) {
  assert(isAbsolute(path ?? ''));
  for (const [target, directory] of [[dirname(path), true], [path, false]]) {
    const stat = lstatSync(target);
    assert(!stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0);
    assert(directory ? stat.isDirectory() : stat.isFile());
    if (!directory) assert(stat.size <= 16_384);
  }
  const fixture = JSON.parse(readFileSync(path));
  assert.equal(fixture.projectId, 'demo-sgm-local-qa');
  assert.match(fixture.runId, /^[a-f0-9]{32}$/);
  assert.match(fixture.password, /^[A-Za-z0-9_-]{12,128}$/);
  return fixture.password;
}

export async function startPrivateFixtureInput(path, {deadlineMs = 180_000} = {}) {
  assert(Number.isInteger(deadlineMs) && deadlineMs >= 100 && deadlineMs <= 180_000);
  let password = readPrivateFixturePassword(path), origin, timer, consumed = false;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'sha256-" + revealHash +
      "'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
    const reject = status => {response.writeHead(status); response.end();};
    // Extension-opened tabs are cross-site document navigations, not cross-origin reads.
    const navigation = request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document';
    if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== new URL(origin).host ||
      request.headers.origin || (['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']) && !navigation)) return reject(403);
    if (request.method !== 'GET' || request.url !== '/') return reject(404);
    if (consumed) return reject(410);
    consumed = true;
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.end('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Saisie de test</title>' +
      '<label>Mot de passe temporaire<input type="password" autocomplete="off" readonly value="' + password +
      '"></label><button type="button">Afficher</button><script>' + revealScript + '</script></html>');
    password = ''; response.once('finish', () => stop(false));
  });
  const closed = new Promise(resolveClosed => server.once('close', resolveClosed));
  const stop = (force = true) => {
    password = ''; clearTimeout(timer); server.close(); server.closeIdleConnections();
    if (force) server.closeAllConnections();
  };
  await new Promise((ready, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', () => {server.removeListener('error', reject); ready();});
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  timer = setTimeout(stop, deadlineMs);
  return {origin, closed, stop};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let input;
  const stop = () => input?.stop();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    assert.equal(process.argv.length, 3);
    input = await startPrivateFixtureInput(process.argv[2]);
    console.log(JSON.stringify({scope: 'one-use-masked-local-fixture-input', origin: input.origin}));
    await input.closed;
    console.log('Private fixture input closed; no credential printed or copied.');
  } catch {console.error('Private fixture input did not complete.'); process.exitCode = 1;}
  finally {input?.stop(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);}
}
