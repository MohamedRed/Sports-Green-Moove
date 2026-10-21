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
    onSpawn: () => h.child.emit('close', 0, null),
  });
  assert.equal(result.code, 0); assert.equal(h.calls.length, 1);
  const [binary, args, options] = h.calls[0]; assert.equal(binary, '/vendor/BrowserStackLocal');
  assert(!JSON.stringify([args, options]).includes(fictionalKey));
  assert.deepEqual(options.stdio, ['ignore', 'ignore', 'ignore']);
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
test('a vendor exit before reading config cancels the private transfer', async t => {
  const h = harness(t);
  await assert.rejects(runScopedLocalBinary('/vendor/BrowserStackLocal', fictionalKey, {
    signal: new AbortController().signal, env: {}, configPipe: h.configPipe,
    spawnImpl: () => { queueMicrotask(() => h.child.emit('close', 127, null)); return h.child; },
  }), /Private credential transfer failed/);
  assert.deepEqual(h.kills, []);
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
  const path = privatePipe(t), reading = readPrivateCredentialPipe(path, new AbortController().signal);
  await writeFile(path, fictionalKey + '\n'); assert.equal(await reading, fictionalKey);
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
    const pending = readPrivateCredentialPipe(path, new AbortController().signal);
    await writeFile(path, text); await assert.rejects(pending);
  }
});
