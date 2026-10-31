import assert from 'node:assert/strict';

const invalid = 'Unexpected disposable connectivity snapshot; raw output withheld';
const transports = new Set(['CELLULAR', 'WIFI', 'BLUETOOTH', 'ETHERNET', 'VPN', 'WIFI_AWARE', 'LOWPAN', 'TEST', 'USB', 'THREAD', 'SATELLITE']);

export function parseDisposableWifiReadiness(output) {
  assert.equal(typeof output, 'string', invalid); assert(Buffer.byteLength(output) <= 2 * 1024 * 1024, invalid);
  const lines = output.split(/\r?\n/);
  const defaults = lines.flatMap(line => /^\s*Active default network: (\d{1,10}|none)\s*$/.exec(line)?.slice(1) ?? []);
  assert.equal(defaults.length, 1, invalid);
  const networks = new Map();
  for (const line of lines) {
    if (!/^\s*NetworkAgentInfo\{network\{/.test(line)) continue;
    const id = /^\s*NetworkAgentInfo\{network\{(\d{1,10})\}/.exec(line)?.[1];
    assert(id && !networks.has(id), invalid);
    assert.equal((line.match(/\bnc\{/g) ?? []).length, 1, invalid);
    const capabilities = line.slice(line.indexOf('nc{'));
    const match = /^nc\{\[\s+Transports: ([A-Z_]+(?:\|[A-Z_]+)*) Capabilities: ([A-Z_]+(?:&[A-Z_]+)*)(?= |\])/.exec(capabilities);
    assert(match, invalid);
    const names = match[1].split('|'), flags = new Set(match[2].split('&'));
    assert(names.every(name => transports.has(name)) && new Set(names).size === names.length, invalid);
    networks.set(id, {transports: names.map(name => name.toLowerCase()), internet: flags.has('INTERNET'),
      validated: flags.has('VALIDATED'), captivePortal: flags.has('CAPTIVE_PORTAL')});
    assert(networks.size <= 32, invalid);
  }
  const active = networks.get(defaults[0]) ?? null;
  return {schemaVersion: 1, scope: 'read-only-default-wifi-capabilities-not-dns-or-flow-proof', atomicObservation: false,
    activeNetworkDeclared: defaults[0] !== 'none', active, availableNetworkCount: networks.size,
    wifiAvailable: [...networks.values()].some(row => row.transports.includes('wifi')),
    ready: Boolean(active && active.transports.length === 1 && active.transports[0] === 'wifi' && active.internet && active.validated && !active.captivePortal),
    identifiersRetained: false, addressesRetained: false, rawLogsRetained: false, newProbesIssued: false};
}
