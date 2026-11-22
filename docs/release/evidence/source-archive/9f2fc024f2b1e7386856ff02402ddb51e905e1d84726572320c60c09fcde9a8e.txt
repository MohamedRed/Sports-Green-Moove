import assert from 'node:assert/strict';

export const invitationRedemptionPath = '/demo-sgm-local-qa/us-central1/redeemChildInvitation';
const origins = new Set(['http://127.0.0.1:4185', 'http://bs-local.com:4185']);
const requestLimit = 16 * 1024, responseLimit = 64 * 1024;
const jsonType = value => typeof value === 'string' && /^application\/json(?:;\s*charset=utf-8)?$/i.test(value);
async function boundedBody(stream, maximum) {
  const chunks = []; let total = 0;
  for await (const value of stream) {
    const chunk = Buffer.from(value); total += chunk.length;
    if (total > maximum) throw new Error('Isolated invitation body exceeds its bound');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function invitationSameOriginMiddleware({approved, projectId, upstreamPort = 5001}) {
  assert.equal(approved, true); assert.equal(projectId, 'demo-sgm-local-qa');
  assert(Number.isInteger(upstreamPort) && upstreamPort > 0 && upstreamPort <= 65535);
  return (request, response, next) => {
    const path = request.url ?? '';
    const reserved = path.includes('/us-central1/') || path.startsWith('/identitytoolkit.googleapis.com/') ||
      path.startsWith('/securetoken.googleapis.com/');
    if (!reserved) return next();
    const fail = (status = 502) => {
      if (response.headersSent || response.writableEnded) {response.destroy(); return;}
      response.writeHead(status, {'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer'});
      response.end(JSON.stringify({error: {status: 'UNAVAILABLE', message: 'Isolated invitation request unavailable'}}));
    };
    const origin = 'http://' + request.headers.host;
    if (path !== invitationRedemptionPath) return fail(404);
    if (!origins.has(origin) || request.headers.origin !== origin || request.headers.authorization || request.headers.cookie) return fail(403);
    if (request.method !== 'POST') return fail(405);
    if (!jsonType(request.headers['content-type'])) return fail(415);
    const length = request.headers['content-length'];
    if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > requestLimit)) return fail(413);
    void (async () => {
      const body = await boundedBody(request, requestLimit);
      const upstream = await fetch('http://127.0.0.1:' + upstreamPort + invitationRedemptionPath, {
        method: 'POST', headers: {'content-type': 'application/json'}, body,
        redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      if (!jsonType(upstream.headers.get('content-type'))) throw new Error('Unexpected isolated invitation response');
      const reply = await boundedBody(upstream.body, responseLimit);
      if (response.destroyed) return;
      response.writeHead(upstream.status, {'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer'});
      response.end(reply);
    })().catch(() => fail());
  };
}
