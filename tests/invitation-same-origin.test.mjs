import assert from 'node:assert/strict';
import {createServer, request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import test from 'node:test';
import ts from 'typescript';
import {parseDocument} from 'yaml';
import {invitationSameOriginMiddleware, invitationRedemptionPath} from '../scripts/qa/invitation-same-origin-proxy.mjs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const compiled = ts.transpileModule(source('admin/src/childInvitationTestEndpoints.ts'),
  {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText;
const {childInvitationTestEndpoints} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('the existing emulator defaults remain exact unless the isolated same-origin mode is approved', () => {
  assert.deepEqual(childInvitationTestEndpoints({development: true, emulators: true, origin: 'http://127.0.0.1:4185'}),
    {authUrl: 'http://127.0.0.1:9099', functionsHost: '127.0.0.1', functionsPort: 5001});
  const approved = {approved: 'true', development: true, emulators: true, projectId: 'demo-sgm-local-qa', origin: 'http://bs-local.com:4185'};
  assert.deepEqual(childInvitationTestEndpoints(approved), {authUrl: approved.origin, functionsHost: 'bs-local.com', functionsPort: 4185});
  for (const changes of [{development: false}, {emulators: false}, {projectId: 'sports-green-moove-prod'}, {approved: 'yes'},
    {origin: 'https://bs-local.com:4185'}, {origin: 'http://127.0.0.1:5001'}, {origin: 'http://public.example:4185'},
    {origin: 'http://user@bs-local.com:4185'}, {origin: 'http://bs-local.com:4185/private'}])
    assert.throws(() => childInvitationTestEndpoints({...approved, ...changes}));
});

async function fixture(t, reply = (_req, response) => {
  response.writeHead(200, {'content-type': 'application/json', 'set-cookie': 'synthetic=private', location: '/not-forwarded'});
  response.end(JSON.stringify({result: {created: true, parentApprovalRequired: true}}));
}) {
  const calls = [];
  const upstream = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    calls.push({url: request.url, body: Buffer.concat(chunks).toString(), headers: request.headers});
    reply(request, response);
  });
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
  const middleware = invitationSameOriginMiddleware({approved: true, projectId: 'demo-sgm-local-qa', upstreamPort: upstream.address().port});
  const server = createServer((request, response) => middleware(request, response, () => {response.writeHead(404); response.end();}));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    for (const item of [server, upstream]) {const stopped = once(item, 'close'); item.close(); item.closeAllConnections(); await stopped;}
  });
  const send = (overrides = {}) => new Promise((resolve, reject) => {
    const body = overrides.method === 'GET' ? '' : overrides.body ?? '{"data":{"token":"synthetic-private-token"}}';
    const request = httpRequest({hostname: '127.0.0.1', port: server.address().port, path: overrides.path ?? invitationRedemptionPath,
      method: overrides.method ?? 'POST', headers: {host: '127.0.0.1:4185', origin: 'http://127.0.0.1:4185',
        'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...overrides.headers}}, async response => {
      const chunks = [];
      try {for await (const chunk of response) chunks.push(chunk);
        resolve(new Response(Buffer.concat(chunks), {status: response.statusCode, headers: response.headers}));
      } catch (error) {reject(error);}
    });
    request.on('error', reject); request.end(body);
  });
  return {send, calls};
}

test('only one anonymous redemption is forwarded unchanged, without cookies, headers, redirects or retries', async t => {
  const f = await fixture(t), response = await f.send();
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), {result: {created: true, parentApprovalRequired: true}});
  assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('location'), null);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, invitationRedemptionPath);
  assert.equal(f.calls[0].body, '{"data":{"token":"synthetic-private-token"}}');
  assert.equal(f.calls[0].headers.authorization, undefined); assert.equal(f.calls[0].headers.cookie, undefined);
});
for (const [name, overrides, status] of [
  ['another host', {headers: {host: 'public.example:4185'}}, 403],
  ['another origin', {headers: {origin: 'http://public.example:4185'}}, 403],
  ['a signed-in session', {headers: {authorization: 'Bearer synthetic-session'}}, 403],
  ['a cookie', {headers: {cookie: 'synthetic-session=1'}}, 403],
  ['another callable', {path: '/demo-sgm-local-qa/us-central1/setUserRoles'}, 404],
  ['another project', {path: '/sports-green-moove-prod/us-central1/redeemChildInvitation'}, 404],
  ['a query', {path: invitationRedemptionPath + '?target=other'}, 404],
  ['unapproved auth transport', {path: '/identitytoolkit.googleapis.com/v1/accounts:signUp'}, 404],
  ['GET', {method: 'GET'}, 405], ['HTML', {headers: {'content-type': 'text/html'}}, 415],
  ['an oversized body', {body: 'x'.repeat(17 * 1024)}, 413],
]) test('same-origin signup refuses ' + name + ' before forwarding', async t => {
  const f = await fixture(t), response = await f.send(overrides); assert.equal(response.status, status); await response.arrayBuffer();
  assert.equal(f.calls.length, 0);
});
test('an upstream redirect is rejected without a second request', async t => {
  const f = await fixture(t, (_request, response) => {response.writeHead(302, {location: '/unexpected'}); response.end();});
  const response = await f.send(); assert.equal(response.status, 502); await response.arrayBuffer(); assert.equal(f.calls.length, 1);
});
test('unexpected upstream content is not exposed to the form', async t => {
  const f = await fixture(t, (_request, response) => {response.writeHead(500, {'content-type': 'text/html'}); response.end('synthetic-private-provider-error');});
  const response = await f.send(); assert.equal(response.status, 502); assert(!(await response.text()).includes('synthetic-private-provider-error'));
  assert.equal(f.calls.length, 1);
});
test('the mode is explicit, isolated, source-bound and does not change global Firebase endpoints', () => {
  const runtime = source('scripts/qa/child-invitation-browser-runtime.mjs'), launch = source('scripts/qa/start-child-invitation-browser.mjs');
  assert(launch.includes('--same-origin-approved')); assert(runtime.includes('invitationSameOriginApproved || invitationAliasApproved'));
  assert(runtime.includes("projectId: process.env.GCLOUD_PROJECT"));
  const gateway = source('admin/src/childInvitationGateway.ts');
  assert(gateway.includes('inMemoryPersistence')); assert(gateway.includes('VITE_INVITATION_SAME_ORIGIN_APPROVED'));
  assert(!source('admin/src/firebase.ts').includes('VITE_INVITATION_SAME_ORIGIN_APPROVED'));
  const workflow = parseDocument(source('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/invitation-same-origin.test.mjs'));
  const rows = workflow.jobs.smoke.steps.filter(row => row.name === 'Test approved invitation same-origin transport');
  assert.deepEqual(rows, [{name: 'Test approved invitation same-origin transport', run: 'node --test tests/invitation-same-origin.test.mjs'}]);
});
