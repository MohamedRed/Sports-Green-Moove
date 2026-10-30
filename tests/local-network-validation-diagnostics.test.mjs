import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';
import {parseNetworkValidationDiagnostics as parseHistory,
  collectNetworkValidationDiagnostics as collect} from '../scripts/qa/local-network-validation-diagnostics.mjs';

const stamp = '2026-10-30T12:00:00.123456 - ';
const network = (id, transports, name = 'private-network') =>
  'NetworkAgentInfo{network{' + id + '} ni{extra: ' + name + '} nc{[ Transports: ' + transports + ' Capabilities: INTERNET&VALIDATED ]}}';
const connectivity = [network(101, 'WIFI'), network(100, 'CELLULAR')].join('\n');
const stack = lines => ['NetworkStack version:', 'LocalInterface:16:private-hash',
  'Device Configs:', 'Ignored private fields: token=DO_NOT_RETAIN', 'Validation logs (most recent first):', ...lines,
  'useNeighborResource: true'].join('\n');
const probe = (kind, message, target = 'https://private.example.test/path?key=DO_NOT_RETAIN') => stamp + 'PROBE_' + kind + ' ' + target + ' ' + message;

test('joins ephemeral network IDs only in memory and retains typed probe outcomes without targets or names', () => {
  const result = parseHistory(stack(['101 - "Private family WiFi"',
    probe('DNS', '12ms OK 192.0.2.11,2001:db8::1', 'private.example.test'),
    probe('HTTP', 'time=34ms ret=204 request={Authorization=DO_NOT_RETAIN} headers={Set-Cookie=PRIVATE}'),
    probe('HTTPS', 'Probe failed with exception java.net.SocketTimeoutException: private.example.test secret'),
    '100 - private.apn', probe('HTTPS', 'time=12ms ret=204 request={} headers={}'),
  ]), connectivity);
  assert.equal(result.atomicObservation, false); assert.equal(result.groupCount, 2);
  assert.deepEqual(result.groups.map(g => g.transports), [['wifi'], ['cellular']]);
  assert.deepEqual(result.groups[0].events, [{probe: 'dns', result: 'success'},
    {probe: 'http', result: 'http-response', httpStatus: 204}, {probe: 'https', result: 'exception', errorKind: 'timeout'}]);
  assert(!/DO_NOT_RETAIN|Private family|private\.|192\.0|2001:|Authorization|Set-Cookie|\b101\b|\b100\b/.test(JSON.stringify(result)));
  for (const key of ['identifiersRetained', 'addressesRetained', 'probeTargetsRetained', 'rawLogsRetained', 'newProbesIssued', 'flowCompleted'])
    assert.equal(result[key], false);
});
test('a missing current network stays unmatched rather than classifying a network name as a transport', () => {
  const result = parseHistory(stack(['999 - WIFI', probe('HTTP', 'time=1ms ret=200 request={} headers={}')] ), connectivity);
  assert.equal(result.groups[0].transportMatched, false); assert.deepEqual(result.groups[0].transports, []);
  assert.deepEqual(result.groups[0].events, [{probe: 'http', result: 'http-response', httpStatus: 200}]);
});
test('headers cannot replace the actual status or inject a probe; unknown formats and errors do not become successes', () => {
  const result = parseHistory(stack(['101 - test',
    probe('HTTP', 'time=1ms ret=403 request={ret=204} headers={ret=204}'),
    probe('HTTP', 'headers={time=1ms ret=204}'),
    probe('HTTPS', 'Probe failed with exception private.secret.Exception: Bearer DO_NOT_RETAIN'),
    probe('PRIVDNS', '2us: [private.example.test/192.0.2.1]'),
    stamp + 'OTHER message PROBE_HTTP ' + 'private.example.test time=1ms ret=204',
  ]), connectivity);
  assert.equal(result.groups[0].unrecognizedProbeLineCount, 3);
  assert.deepEqual(result.groups[0].events, [{probe: 'http', result: 'http-response', httpStatus: 403},
    {probe: 'https', result: 'exception', errorKind: 'unclassified-exception'}]);
  assert(!JSON.stringify(result).includes('DO_NOT_RETAIN'));
});
test('known DNS failure and exception categories remain distinct', () => {
  const result = parseHistory(stack(['101 - test', probe('DNS', '3012ms FAIL in type ADDRCONFIG Timeout'),
    probe('HTTPS', 'Probe failed with exception javax.net.ssl.SSLHandshakeException: private certificate'),
    probe('HTTP', 'Probe failed with exception java.net.UnknownHostException: private.example.test')]), connectivity);
  assert.deepEqual(result.groups[0].events, [{probe: 'dns', result: 'failure'},
    {probe: 'https', result: 'exception', errorKind: 'tls-handshake'}, {probe: 'http', result: 'exception', errorKind: 'dns-resolution'}]);
});
test('truncation is explicit and cannot imply complete retained history', () => {
  const result = parseHistory(stack(['101 - test', ...Array.from({length: 130}, () => probe('HTTP', 'time=1ms ret=204 request={} headers={}'))]), connectivity);
  assert.equal(result.groups[0].probeLineCount, 130); assert.equal(result.groups[0].events.length, 128);
  assert.equal(result.groups[0].eventsTruncated, true);
});
test('wrong service, missing/duplicate section, oversized input, orphan probes and ambiguous capability fields fail closed', () => {
  for (const [raw, current] of [
    ['private raw error', connectivity], [stack([]).replace('Validation logs (most recent first):', ''), connectivity],
    [stack([]) + '\nValidation logs (most recent first):', connectivity], ['x'.repeat(2 * 1024 * 1024 + 1), connectivity],
    [stack([probe('DNS', '1ms OK 192.0.2.1')]), connectivity],
    [stack([]), network(101, 'WIFI') + '\n' + network(101, 'CELLULAR')],
    [stack([]), network(101, 'FUTURE_PRIVATE')],
    [stack([]), network(101, 'CELLULAR', 'nc{[ Transports: WIFI')],
  ]) assert.throws(() => parseHistory(raw, current), error => {
    assert(!error.message.includes('private raw error')); return true;
  });
});
test('only the actual capability section supplies the transport, not a marker inside a network name', () => {
  const result = parseHistory(stack(['101 - private']), network(101, 'CELLULAR', 'Transports: WIFI'));
  assert.deepEqual(result.groups[0].transports, ['cellular']);
});
test('collector is disposable-only, bounded, read-only and writes only the parsed receipt', t => {
  const original = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR;
  t.after(() => {if (original === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = original;});
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  const commands = [], writes = [];
  const execute = (_adb, args, options) => {
    commands.push(args.join(' ')); assert(options.timeout <= 30_000);
    if (args.includes('wait-for-device')) return '';
    if (args.includes('get-state')) return 'device\n';
    if (args.includes('ro.kernel.qemu')) return '1\n';
    if (args.includes('ro.build.version.sdk')) return '35\n';
    if (args.includes('network_stack')) return stack(['101 - private', probe('HTTP', 'time=1ms ret=204 request={} headers={}')] );
    if (args.includes('connectivity')) return connectivity;
    throw new Error('Unexpected command');
  };
  const result = collect('/adb', 'emulator-5554', 'a'.repeat(32), 'after', '/private/test', execute, (...args) => writes.push(args));
  assert.equal(result.scope, 'read-only-disposable-network-validation-history');
  assert.equal(writes.length, 1); assert.equal(writes[0][0], '/private/test/chat-network-validation-after.json');
  assert.equal(writes[0][2].mode, 0o600); assert.equal(writes[0][2].flag, 'wx');
  assert.deepEqual(commands.slice(-2), ['-s emulator-5554 shell dumpsys network_stack', '-s emulator-5554 shell dumpsys connectivity']);
  assert(!/setprop|settings|svc |curl|ping|force-stop|reboot|logcat/.test(commands.join('\n')));
  assert(!writes[0][1].includes('private.example.test'));
  const count = commands.length;
  process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'false';
  assert.throws(() => collect('/adb', 'emulator-5554', 'a'.repeat(32), 'after', '/private/test', execute));
  assert.equal(commands.length, count);
});
test('command failure does not expose stderr, and replay still restores the device after diagnostic failure', t => {
  const original = process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = 'true';
  t.after(() => {if (original === undefined) delete process.env.SGM_LOCAL_DISPOSABLE_EMULATOR; else process.env.SGM_LOCAL_DISPOSABLE_EMULATOR = original;});
  const execute = (_adb, args) => {
    if (args.includes('wait-for-device')) return '';
    if (args.includes('get-state')) return 'device';
    if (args.includes('ro.kernel.qemu')) return '1';
    throw Object.assign(new Error('DO_NOT_RETAIN'), {stderr: 'DO_NOT_RETAIN'});
  };
  assert.throws(() => collect('/adb', 'emulator-5554', 'a'.repeat(32), 'before', '/private/test', execute),
    error => !error.message.includes('DO_NOT_RETAIN') && error.message.includes('raw output withheld'));
  const source = readFileSync('scripts/qa/local-network-replay.mjs', 'utf8');
  assert(source.indexOf("collectValidation('before')") < source.indexOf("instrument(['LocalChatNetworkFlowTest']"));
  assert(source.includes("() => collectValidation('after')")); assert(source.includes('finishDisposableCleanup(failure,'));
});
test('all relevant CI paths run the diagnostic contracts without a radio or application trial', () => {
  for (const name of ['native-ci.yml', 'backend-ci.yml', 'web-integration-smoke.yml']) {
    const source = readFileSync('.github/workflows/' + name, 'utf8'), workflow = parse(source);
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
    assert(steps.some(step => step.name === 'Test private Android network validation history' &&
      step.run === 'node --test tests/local-network-validation-diagnostics.test.mjs tests/chat-network-latest-evidence.test.mjs'));
    if (name !== 'backend-ci.yml') assert.equal(source.split('"tests/local-network-validation-diagnostics.test.mjs"').length - 1, 2);
  }
});
