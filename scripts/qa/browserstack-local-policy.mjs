import assert from 'node:assert/strict';

export const isolatedPorts = Object.freeze([5001, 8080, 9000, 9099]);
export const isolatedLocalAllowlist = ['127.0.0.1', 'localhost']
  .flatMap((host) => isolatedPorts.map((port) => `${host},${port},0`)).join(',');

export function assertIsolatedTunnelSettings(settings) {
  assert.equal(settings.forceLocal, false, 'Force Local overrides the private service allowlist');
  assert.equal(settings.verbose, false, 'Test credentials must not enter request logs');
  assert.equal(settings.enableLoggingForApi, false, 'The tunnel API must not expose test requests');
  assert.equal(settings.mitmProxy, false, 'Do not disable encrypted transport protections');
  assert.equal(settings.folderTesting, '', 'Do not expose workspace files');
  assert.equal(settings.includeHosts, '', 'Do not expand the tunnel host scope');
  assert.equal(settings.excludeHosts, '', 'Use the exact four-service allowlist');
  assert.equal(settings.onlyAllow, isolatedLocalAllowlist, 'Only the isolated loopback services may be forwarded');
}
