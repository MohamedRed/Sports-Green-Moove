import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync, mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { runScopedLocalBinary, scopedLocalArguments, scopedLocalSettings, allowedHelperEnvironment } from '../scripts/qa/scoped-browserstack-local.mjs';
import { isolatedLocalAllowlist, assertIsolatedTunnelSettings } from '../scripts/qa/browserstack-local-policy.mjs';
import { readPrivateCredentialPipe } from '../scripts/qa/read-private-credential-pipe.mjs';
import { writePrivateConfigPipe } from '../scripts/qa/write-private-config-pipe.mjs';

const fictionalKey = 'FictionalCredentialForTestOnly';
function harness(t) {
  const child = new EventEmitter(); child.pid = 123; const kills = [], calls = [], configPipe = privatePipe(t);
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const h = { child, kills, calls, configPipe };
  child.kill = signal => { kills.push(signal); queueMicrotask(() => child.emit('close', null, signal)); };
  h.spawnImpl = (...args) => { calls.push(args); h.received = readFile(configPipe, 'utf8'); return child; };
  return h;
}
test('all restrictions precede authentication and cannot be changed by credential input', () => {
  assertIsolatedTunnelSettings(scopedLocalSettings);
  assert.deepEqual(scopedLocalArguments('/private/vendor-config.yml'), ['--config-file', '/private/vendor-config.yml', '--only', isolatedLocalAllowlist,
    '--verbose', '0', '--log-file', '/dev/null', '--disable-dashboard', '--timeout', '10']);
  assert(!scopedLocalArguments('/private/vendor-config.yml').some(value => /--key|--force-local|--folder|--enable-logging-for-api/.test(value)));
});
test('the private config FIFO contains only the key; argv, env and logs cannot contain it', async t => {
  const h = harness(t), controller = new AbortController();
  const result = await runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: controller.signal, env: { HOME: '/private/owned-home' }, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => { controller.abort('SIGTERM'); h.child.emit('close', 0, null); },
  });
  assert.equal(result.code, 0); assert.equal(h.calls.length, 1);
  const [binary, args, options] = h.calls[0]; assert.equal(binary, '/vendor/BrowserStackLocal');
  assert(!JSON.stringify([args, options]).includes(fictionalKey));
  assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(await h.received, `key: ${fictionalKey}\n`);
});
test('an already aborted launch cannot start a provider process', async t => {
  const h = harness(t), controller = new AbortController(); controller.abort('SIGINT');
  const result = await runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey,
    { signal: controller.signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl });
  assert.equal(result.spawned, false); assert.equal(h.calls.length, 0);
});
test('stopping the owned process sends one signal and preserves its terminal outcome', async t => {
  const h = harness(t), controller = new AbortController();
  const result = await runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: controller.signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl, onSpawn: () => controller.abort('SIGINT'),
  });
  assert.deepEqual(h.kills, ['SIGINT']); assert.equal(result.stopped, true); assert.equal(result.signal, 'SIGINT');
});
test('a failed provider process is not retried or declared connected', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl, onSpawn: () => h.child.emit('close', 7, null),
  }), /no device flow is verified/);
  assert.equal(h.calls.length, 1);
});
test('an unsolicited zero exit is a lost connection, never a successful owned shutdown or a retry', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => h.child.emit('close', 0, null),
  }), error => {
    assert.equal(error.vendorOutcome.code, 0); assert.equal(error.vendorOutcome.signal, null);
    assert.equal(error.vendorOutcome.stopRequested, false);
    assert.match(error.message, /no device flow is verified/);
    assert(!JSON.stringify(error).includes(fictionalKey)); return true;
  });
  assert.equal(h.calls.length, 1); assert.deepEqual(h.kills, []);
});
test('requesting a stop after the child already exited cannot retroactively accept that exit', async t => {
  const h = harness(t), controller = new AbortController();
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: controller.signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => { h.child.emit('close', 0, null); controller.abort('SIGTERM'); },
  }), error => error.vendorOutcome.stopRequested === false);
  assert.deepEqual(h.kills, []);
});
test('an external termination signal is not an owner-requested stop', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => h.child.emit('close', null, 'SIGTERM'),
  }), error => error.vendorOutcome.signal === 'SIGTERM' && error.vendorOutcome.stopRequested === false);
  assert.equal(h.calls.length, 1);
});
test('a vendor exit before reading config cancels the private transfer', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe,
    spawnImpl: () => { queueMicrotask(() => h.child.emit('close', 127, null)); return h.child; },
  }), /Private credential transfer failed/);
  assert.deepEqual(h.kills, []);
});
test('vendor failures retain only fixed classifications and exit status, never output or credentials', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => {
      h.child.stdout.emit('data', `Invalid access key ${fictionalKey}`);
      h.child.stderr.emit('data', `Address already in use; private request body ${fictionalKey}`);
      h.child.emit('close', 7, null);
    },
  }), error => {
    assert.equal(error.vendorOutcome.code, 7); assert.equal(error.vendorOutcome.signal, null);
    assert.deepEqual(error.vendorOutcome.diagnostics, {authenticationRejected: true, duplicateConnection: false,
      portUnavailable: true, networkFailure: false, configurationRejected: false});
    assert(!JSON.stringify(error).includes(fictionalKey)); assert(!String(error).includes(fictionalKey)); return true;
  });
  assert.equal(h.calls.length, 1); assert.equal(h.child.stdout.listenerCount('data'), 0);
});
test('approved startup diagnostics preserve restrictions and redact split or truncated credential output', async t => {
  for (const truncated of [false, true]) {
    const h = harness(t);
    const logPipe = privatePipe(t);
    await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
      signal: new AbortController().signal, env: {}, configPipe: h.configPipe, logPipe, startupDiagnostic: true, spawnImpl: h.spawnImpl,
      onSpawn: () => {
        h.child.stdout.emit('data', (truncated ? 'x'.repeat(8185) : 'Startup failed: ') + fictionalKey.slice(0, 10));
        h.child.stderr.emit('data', fictionalKey.slice(10)); h.child.emit('close', 126, null);
      },
    }), error => {
      const output = error.vendorOutcome.startupOutput;
      assert.equal(error.vendorOutcome.code, 126); assert.equal(error.vendorOutcome.startupOutputTruncated, truncated);
      assert(!output.includes(fictionalKey)); assert(!output.includes(fictionalKey.slice(0, 7)));
      assert(truncated || output.includes('[REDACTED]')); return true;
    });
    const args = h.calls[0][1]; assert.equal(args[args.indexOf('--verbose') + 1], '1');
    assert.equal(args[args.indexOf('--only') + 1], isolatedLocalAllowlist);
    assert.equal(args[args.indexOf('--log-file') + 1], logPipe);
    assert(!args.includes('--enable-logging-for-api')); assert(args.includes('--disable-dashboard'));
  }
  assert.equal(scopedLocalArguments('/private/config.pipe')[5], '0', 'Startup verbosity never becomes the default');
});
test('approved log-file output is consumed from a real private FIFO and redacted before retention', async t => {
  const h = harness(t), logPipe = privatePipe(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, logPipe, startupDiagnostic: true, spawnImpl: h.spawnImpl,
    onSpawn: () => { writeFile(logPipe, `Authentication failed: ${fictionalKey}\n`)
      .then(() => h.child.emit('close', 126, null)); },
  }), error => {
    assert.equal(error.vendorOutcome.diagnostics.authenticationRejected, true);
    assert.match(error.vendorOutcome.startupOutput, /Authentication failed: \[REDACTED\]/);
    assert(!JSON.stringify(error).includes(fictionalKey)); return true;
  });
  assert.equal(h.calls.length, 1);
});
test('log capture cannot be enabled implicitly, share the credential pipe or use an ordinary file', async t => {
  const h = harness(t), options = {signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl};
  for (const changes of [{logPipe: privatePipe(t)}, {startupDiagnostic: true},
    {startupDiagnostic: true, logPipe: h.configPipe}, {startupDiagnostic: true, logPipe: import.meta.filename}])
    await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {...options, ...changes}));
  assert.equal(h.calls.length, 0);
});
test('a receipt callback failure still stops the owned provider process', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe, spawnImpl: h.spawnImpl,
    onSpawn: () => { throw new Error('receipt unavailable'); },
  }), /receipt unavailable/);
  assert.deepEqual(h.kills, ['SIGTERM']);
});
test('unscoped environment and invalid input are rejected before spawning', async t => {
  for (const [key, env] of [['short', {}], [fictionalKey, { BROWSERSTACK_ACCESS_KEY: fictionalKey }],
    [fictionalKey, { HOME: 'prefix-' + fictionalKey }], [fictionalKey + '\nforce-local: true', {}]]) {
    const h = harness(t);
    await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', key,
      { signal: new AbortController().signal, env, configPipe: h.configPipe, spawnImpl: h.spawnImpl }));
    assert.equal(h.calls.length, 0);
  }
});
test('the platform-injected macOS text-encoding variable is permitted without allowing provider credentials', () => {
  assert(allowedHelperEnvironment.includes('__CF_USER_TEXT_ENCODING'));
  for (const name of ['BROWSERSTACK_ACCESS_KEY', 'BROWSERSTACK_USERNAME', 'NODE_OPTIONS', 'SGM_QA_PASSWORD'])
    assert(!allowedHelperEnvironment.includes(name));
});
test('the macOS entry point verifies the vendor and uses an owned private pipe with supervised cleanup', () => {
  const read = file => readFileSync(new URL('../scripts/qa/' + file, import.meta.url), 'utf8');
  const start = read('start-scoped-browserstack-local.mjs'), worker = read('run-scoped-browserstack-local.mjs');
  const input = read('read-private-credential-pipe.mjs');
  assert(start.includes("TeamIdentifier=YQ5FZQ855D")); assert(start.includes("['-m', '600', pipe]"));
  assert(start.includes('superviseLocalProcess')); assert(start.includes('if (verified) { rmSync(temp'));
  assert(input.includes('info.isFIFO()')); assert(input.includes('(info.mode & 0o777) === 0o600'));
  assert(input.includes('(parent.mode & 0o777) === 0o700')); assert(input.includes('length <= 257'));
  assert(input.includes('value.fill(0)')); assert(input.includes('constants.O_RDWR | constants.O_NONBLOCK | constants.O_NOFOLLOW'));
  assert(!worker.includes('console.error(error')); assert(!worker.includes('console.log(accessKey'));
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/scoped-browserstack-local.test.mjs"').length - 1, 2);
  assert(workflow.includes('tests/browserstack-parent-search-evidence.test.mjs tests/scoped-browserstack-local.test.mjs'));
});

function privatePipe(t) {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-private-pipe-test-')), path = resolve(directory, 'input.pipe');
  execFileSync('mkfifo', ['-m', '600', path]); t.after(() => rmSync(directory, { recursive: true, force: true }));
  return path;
}
test('actual private FIFO transfer finishes without a prefetched blocking read', async t => {
  const path = privatePipe(t);
  const [value] = await Promise.all([readPrivateCredentialPipe(path, new AbortController().signal), writeFile(path, fictionalKey + '\n')]);
  assert.equal(value, fictionalKey);
});
test('an idle credential pipe can be cancelled without leaving a blocked filesystem read', async t => {
  const path = privatePipe(t), controller = new AbortController();
  const pending = readPrivateCredentialPipe(path, controller.signal);
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(pending, error => error.name === 'AbortError');
});
test('an unread vendor config pipe can be cancelled without leaving a blocked open', async t => {
  const path = privatePipe(t), controller = new AbortController();
  const pending = writePrivateConfigPipe(path, Buffer.from('key: fictional\n'), controller.signal);
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(pending, error => error.name === 'AbortError');
});
test('publicly readable pipes and oversized or multiline input are rejected', async t => {
  const path = privatePipe(t); chmodSync(path, 0o644);
  await assert.rejects(readPrivateCredentialPipe(path, new AbortController().signal)); chmodSync(path, 0o600);
  for (const text of ['x'.repeat(258), 'first\nsecond\n']) {
    await Promise.all([
      assert.rejects(readPrivateCredentialPipe(path, new AbortController().signal),
        {message: text.length === 258 ? 'Private credential input is too long' : 'One private credential line is required'}),
      writeFile(path, text),
    ]);
  }
});
