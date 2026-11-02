import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {execFileSync} from 'node:child_process';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {parse} from 'yaml';
import {assertInvitationAliasTarget, privateInvitationAlias} from '../scripts/qa/invitation-private-alias.mjs';
import {isolatedLocalAllowlist, invitationSignupAllowlist, invitationAliasAllowlist,
  assertIsolatedTunnelSettings} from '../scripts/qa/browserstack-local-policy.mjs';
import {invitationAliasSettings, scopedLocalArguments, runScopedLocalBinary} from '../scripts/qa/scoped-browserstack-local.mjs';

test('the approved alias adds only one HTTP endpoint and cannot become the default or an implicit extra host', () => {
  assert.equal(privateInvitationAlias, 'bs-local.com');
  assert.equal(invitationAliasAllowlist, invitationSignupAllowlist + ',bs-local.com,4185,0');
  assert.throws(() => assertIsolatedTunnelSettings(invitationAliasSettings));
  assert.throws(() => assertIsolatedTunnelSettings(invitationAliasSettings, true));
  assert.throws(() => assertIsolatedTunnelSettings(invitationAliasSettings, false, true));
  assertIsolatedTunnelSettings(invitationAliasSettings, true, true);
  assert.equal(scopedLocalArguments('/private/config.pipe')[3], isolatedLocalAllowlist);
  assert.equal(scopedLocalArguments('/private/config.pipe', false, undefined, true, true)[3], invitationAliasAllowlist);
  for (const onlyAllow of [invitationAliasAllowlist + ',bs-local.com,9099,0',
    invitationAliasAllowlist.replace('bs-local.com,4185,0', 'example.com,4185,0'),
    invitationAliasAllowlist.replace('bs-local.com,4185,0', 'bs-local.com,4185,1')])
    assert.throws(() => assertIsolatedTunnelSettings({...invitationAliasSettings, onlyAllow}, true, true));
  for (const key of ['forceLocal', 'verbose', 'enableLoggingForApi', 'mitmProxy'])
    assert.throws(() => assertIsolatedTunnelSettings({...invitationAliasSettings, [key]: true}, true, true));
});
test('alias resolution accepts only observed loopback addresses, never a public or LAN target', async () => {
  assert.deepEqual(await assertInvitationAliasTarget(async (host, options) => {
    assert.equal(host, 'bs-local.com'); assert.deepEqual(options, {all: true});
    return [{address: '127.0.0.1'}, {address: '::1'}];
  }), {host: 'bs-local.com', port: 4185, loopbackOnly: true});
  for (const rows of [[], [{address: '192.168.1.10'}], [{address: '203.0.113.5'}],
    [{address: '127.0.0.1'}, {address: '203.0.113.5'}]])
    await assert.rejects(assertInvitationAliasTarget(async () => rows), /only to loopback/);
  await assert.rejects(assertInvitationAliasTarget(async () => {throw new Error('DNS unavailable');}), /DNS unavailable/);
});
function privatePipe(t) {
  const folder = mkdtempSync(join(tmpdir(), 'sgm-invitation-alias-'));
  t.after(() => rmSync(folder, {recursive: true, force: true}));
  const pipe = join(folder, 'config.pipe'); execFileSync('/usr/bin/mkfifo', ['-m', '600', pipe]); return pipe;
}
test('DNS verification precedes the single credentialed process launch and preserves private input', async t => {
  const pipe = privatePipe(t), order = [], controller = new AbortController(), child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = signal => child.emit('close', null, signal);
  let received;
  const key = 'FictionalAliasCredentialForTestOnly';
  const result = await runScopedLocalBinary('/vendor/BrowserStackLocal', key, {signal: controller.signal, env: {},
    configPipe: pipe, invitationSignupApproved: true, invitationAliasApproved: true,
    verifyAlias: async () => {order.push('resolve');}, spawnImpl: (_binary, args, options) => {
      order.push('spawn'); assert.equal(args[3], invitationAliasAllowlist); assert(!JSON.stringify({args, options}).includes(key));
      received = readFile(pipe, 'utf8'); return child;
    }, onSpawn: () => controller.abort('SIGTERM')});
  assert.deepEqual(order, ['resolve', 'spawn']); assert.equal(result.stopped, true);
  assert.equal(await received, 'key: ' + key + '\n');
});
for (const mode of ['resolution-failed', 'cancelled-during-resolution']) test('no vendor starts after ' + mode, async t => {
  const controller = new AbortController(), options = {signal: controller.signal, env: {}, configPipe: privatePipe(t),
    invitationSignupApproved: true, invitationAliasApproved: true, spawnImpl: () => assert.fail('No vendor may start'),
    verifyAlias: async () => {
      if (mode === 'resolution-failed') throw new Error('Unverified alias');
      controller.abort('SIGINT');
    }};
  const pending = runScopedLocalBinary('/vendor/BrowserStackLocal', 'FictionalAliasCredentialForTestOnly', options);
  if (mode === 'resolution-failed') await assert.rejects(pending, /Unverified alias/);
  else assert.equal((await pending).spawned, false);
});
test('the web server and supervised entry points require explicit phone-only alias approval', () => {
  const read = file => readFileSync(new URL('../scripts/qa/' + file, import.meta.url), 'utf8');
  const launch = read('start-child-invitation-browser.mjs'), runtime = read('child-invitation-browser-runtime.mjs');
  assert.match(launch, /--private-alias-approved/); assert.match(launch, /!invitationAliasApproved \|\| phoneSession/);
  assert.match(runtime, /if \(invitationAliasApproved\)[\s\S]*assertInvitationAliasTarget/);
  assert.match(runtime, /host: '127\.0\.0\.1', port: 4185, strictPort: true/);
  assert.match(runtime, /invitationAliasApproved \? \{allowedHosts: \[privateInvitationAlias\]\} : \{\}/);
  for (const file of ['start-scoped-browserstack-local.mjs', 'run-scoped-browserstack-local.mjs'])
    assert.match(read(file), /--child-invitation-alias-approved/);
  const workflow = parse(readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8'));
  for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/invitation-private-alias.test.mjs'));
  assert(workflow.jobs.smoke.steps.some(row => row.run === 'node --test tests/invitation-private-alias.test.mjs'));
});
