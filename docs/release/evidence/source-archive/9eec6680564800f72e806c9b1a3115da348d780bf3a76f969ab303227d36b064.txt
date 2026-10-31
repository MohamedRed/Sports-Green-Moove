import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import {waitForDisposableDevice} from './disposable-device-cleanup.mjs';

const limit = 2 * 1024 * 1024;
const invalid = 'Unexpected Android network validation history; raw output withheld';
const transportNames = new Set(['CELLULAR', 'WIFI', 'BLUETOOTH', 'ETHERNET', 'VPN', 'WIFI_AWARE', 'LOWPAN', 'TEST', 'USB', 'THREAD', 'SATELLITE']);
const exceptionNames = new Map([
  ['java.net.SocketTimeoutException', 'timeout'], ['java.io.InterruptedIOException', 'interrupted-io'],
  ['java.net.UnknownHostException', 'dns-resolution'], ['java.net.ConnectException', 'connection'],
  ['java.net.NoRouteToHostException', 'no-route'], ['java.net.SocketException', 'socket'],
  ['javax.net.ssl.SSLHandshakeException', 'tls-handshake'], ['javax.net.ssl.SSLProtocolException', 'tls-protocol'],
  ['java.io.IOException', 'io'],
]);
function text(value) {
  assert.equal(typeof value, 'string', invalid); assert(Buffer.byteLength(value) <= limit, invalid);
  return value.split(/\r?\n/);
}
function networkTransports(output) {
  const networks = new Map();
  for (const line of text(output)) {
    if (!/^\s*NetworkAgentInfo\{network\{/.test(line)) continue;
    const id = line.match(/^\s*NetworkAgentInfo\{network\{(\d{1,10})\}/)?.[1];
    assert.equal((line.match(/\bnc\{/g) ?? []).length, 1, invalid);
    const capabilities = line.slice(line.indexOf('nc{'));
    const names = capabilities.match(/^nc\{\[ Transports: ([A-Z_]+(?:\|[A-Z_]+)*)\b/)?.[1]?.split('|');
    assert(id && names?.length && names.every(name => transportNames.has(name)), invalid);
    assert(!networks.has(id), invalid); networks.set(id, names.map(name => name.toLowerCase()));
  }
  return networks;
}
function probeEvent(kind, message) {
  if (kind === 'DNS') {
    const result = message.match(/^\d+(?:ms|us):? (OK|FAIL)\b/);
    if (result) return {probe: 'dns', result: result[1] === 'OK' ? 'success' : 'failure'};
  }
  if (['HTTP', 'HTTPS', 'FALLBACK', 'PAC'].includes(kind)) {
    const response = message.match(/^time=\d+ms ret=([1-5]\d{2})(?:\s|$)/);
    if (response) return {probe: kind.toLowerCase(), result: 'http-response', httpStatus: Number(response[1])};
    const failure = message.match(/^Probe failed with exception ([A-Za-z][A-Za-z0-9_.]+)(?::|$)/);
    if (failure) return {probe: kind.toLowerCase(), result: 'exception',
      errorKind: exceptionNames.get(failure[1]) ?? 'unclassified-exception'};
  }
  return null;
}
export function parseNetworkValidationDiagnostics(stack, connectivity) {
  const lines = text(stack), networks = networkTransports(connectivity);
  assert.equal(lines.filter(line => line.trim() === 'NetworkStack version:').length, 1, invalid);
  const headers = lines.flatMap((line, index) => line.trim() === 'Validation logs (most recent first):' ? [index] : []);
  assert.equal(headers.length, 1, invalid);
  const groups = []; let group;
  for (const line of lines.slice(headers[0] + 1)) {
    if (/^useNeighborResource:/.test(line.trim())) break;
    const header = line.match(/^\s*(\d{1,10}) - .+$/);
    if (header) {
      assert(groups.length < 10, invalid);
      group = {ordinal: groups.length + 1, transportMatched: networks.has(header[1]),
        transports: networks.get(header[1]) ?? [], probeLineCount: 0, unrecognizedProbeLineCount: 0,
        eventsTruncated: false, events: []};
      groups.push(group); continue;
    }
    const probe = line.match(/^\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,9} - PROBE_([A-Z_]+) \S+ (.*)$/);
    if (!probe) {
      if (group && /\bPROBE_[A-Z_]+\b/.test(line)) {group.probeLineCount++; group.unrecognizedProbeLineCount++;}
      continue;
    }
    assert(group, invalid); group.probeLineCount++;
    const event = probeEvent(probe[1], probe[2]);
    if (!event) {group.unrecognizedProbeLineCount++; continue;}
    if (group.events.length < 128) group.events.push(event); else group.eventsTruncated = true;
  }
  return {schemaVersion: 1, source: 'bounded-android-validation-history-not-current-capabilities-or-selection-reason',
    atomicObservation: false, groupCount: groups.length, groups,
    identifiersRetained: false, addressesRetained: false, probeTargetsRetained: false,
    rawLogsRetained: false, newProbesIssued: false, flowCompleted: false};
}
export function collectNetworkValidationDiagnostics(adb, serial, runId, phase, outputDir,
  execute = execFileSync, write = writeFileSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.match(serial, /^emulator-\d+$/); assert.match(runId, /^[a-f0-9]{32}$/);
  assert(['before', 'after'].includes(phase)); assert(isAbsolute(outputDir));
  waitForDisposableDevice(adb, serial, execute);
  const options = {encoding: 'utf8', timeout: 30_000, maxBuffer: limit, stdio: ['ignore', 'pipe', 'pipe']};
  let stack, connectivity;
  try {
    assert.equal(execute(adb, ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'], options).trim(), '35');
    stack = execute(adb, ['-s', serial, 'shell', 'dumpsys', 'network_stack'], options);
    connectivity = execute(adb, ['-s', serial, 'shell', 'dumpsys', 'connectivity'], options);
  } catch {throw new Error('Disposable Android validation diagnostic command failed; raw output withheld');}
  const receipt = {projectId: 'demo-sgm-local-qa', runId, phase, recordedAt: new Date().toISOString(),
    scope: 'read-only-disposable-network-validation-history', ...parseNetworkValidationDiagnostics(stack, connectivity)};
  write(resolve(outputDir, 'chat-network-validation-' + phase + '.json'), JSON.stringify(receipt, null, 2) + '\n',
    {flag: 'wx', mode: 0o600});
  return receipt;
}
