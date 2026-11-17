import assert from 'node:assert/strict';

export const sessionTransportPhases = ['before-sign-in', 'signed-in', 'launching-app', 'initial-error',
  'rotated-error', 'recovered', 'restored', 'identity-verified'];

const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
export function validateSessionTransportObservations(receipt, runId, { complete = false } = {}) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  exactKeys(receipt, ['scope', 'projectId', 'runId', 'networkSettingsChanged', 'authenticationRetried', 'observations']);
  assert.equal(receipt.scope, 'read-only-local-session-transport-not-flow-verification');
  assert.equal(receipt.projectId, 'demo-sgm-local-qa'); assert.equal(receipt.runId, runId);
  assert.equal(receipt.networkSettingsChanged, false); assert.equal(receipt.authenticationRetried, false);
  const items = receipt.observations;
  assert(Array.isArray(items) && items.length > 0 && items.length <= 9);
  const phases = items.map(item => item.phase), failed = phases.at(-1) === 'failure';
  const regular = failed ? phases.slice(0, -1) : phases;
  assert.deepEqual(regular, sessionTransportPhases.slice(0, regular.length));
  assert(regular.length > 0); assert.equal(new Set(phases).size, phases.length);
  if (complete) { assert.equal(failed, false); assert.deepEqual(phases, sessionTransportPhases); }
  let elapsed = -1, proxyPort;
  for (const item of items) {
    const probes = item.phase === 'before-sign-in' || item.phase === 'failure';
    exactKeys(item, ['phase', 'elapsedRealtimeMs', 'activeNetwork', 'internetCapability', 'validatedCapability',
      'transports', ...(probes ? ['tcp'] : [])]);
    assert(Number.isSafeInteger(item.elapsedRealtimeMs) && item.elapsedRealtimeMs >= elapsed);
    elapsed = item.elapsedRealtimeMs;
    for (const key of ['activeNetwork', 'internetCapability', 'validatedCapability']) assert.equal(typeof item[key], 'boolean');
    assert(Array.isArray(item.transports) && new Set(item.transports).size === item.transports.length);
    assert(item.transports.every(name => ['wifi', 'cellular', 'ethernet', 'vpn'].includes(name)));
    if (!probes) continue;
    assert(Array.isArray(item.tcp));
    assert.deepEqual(item.tcp.map(probe => probe.service), ['auth', 'functions', 'controlled-proxy']);
    for (const [index, probe] of item.tcp.entries()) {
      exactKeys(probe, ['service', 'port', 'connected', 'failureKind']);
      if (index < 2) assert.equal(probe.port, [9099, 5001][index]);
      else {
        assert(Number.isInteger(probe.port) && probe.port >= 1024 && probe.port <= 65535 && ![9099, 5001].includes(probe.port));
        if (proxyPort !== undefined) assert.equal(probe.port, proxyPort);
        proxyPort = probe.port;
      }
      assert.equal(typeof probe.connected, 'boolean');
      if (probe.connected) assert.equal(probe.failureKind, null);
      else assert.match(probe.failureKind, /^[A-Za-z]{1,60}Exception$/);
    }
  }
  return { scope: receipt.scope, observationCount: items.length, failureObserved: failed };
}
