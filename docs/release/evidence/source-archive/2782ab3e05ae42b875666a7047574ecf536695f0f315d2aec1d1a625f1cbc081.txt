import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import { syncBuiltinESMExports } from 'node:module';

function assertLoopback(target) {
  const hostname = typeof target === 'string' || target instanceof URL
    ? new URL(target).hostname
    : (target.hostname || target.host || 'localhost').split(':')[0];
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)) {
    throw new Error('Local QA blocks non-loopback network requests');
  }
}

for (const protocol of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = protocol[method];
    protocol[method] = function (target, ...args) {
      assertLoopback(target);
      // Explicit options can override a URL's host.
      if (typeof args[0] === 'object' && (args[0].hostname || args[0].host)) assertLoopback(args[0]);
      return original.call(this, target, ...args);
    };
  }
}
const connect = http2.connect;
http2.connect = function (authority, ...args) {
  assertLoopback(authority);
  return connect.call(this, authority, ...args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, ...args) {
  assertLoopback(typeof input === 'object' && !(input instanceof URL) ? input.url : input);
  return originalFetch(input, ...args);
};
syncBuiltinESMExports();
