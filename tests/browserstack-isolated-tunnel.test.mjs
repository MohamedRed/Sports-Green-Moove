import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isolatedPorts, isolatedLocalAllowlist, invitationSignupAllowlist, assertIsolatedTunnelSettings } from '../scripts/qa/browserstack-local-policy.mjs';
import {scopedLocalArguments} from '../scripts/qa/scoped-browserstack-local.mjs';

const settings = { onlyAllow: isolatedLocalAllowlist, forceLocal: false, verbose: false,
  enableLoggingForApi: false, mitmProxy: false, folderTesting: '', includeHosts: '', excludeHosts: '' };

test('private tunnel permits exactly four loopback demo services with logging and broad routing disabled', () => {
  assert.deepEqual(isolatedPorts, [5001, 8080, 9000, 9099]);
  const entries = isolatedLocalAllowlist.split(','); assert.equal(entries.length, 24);
  for (let index = 0; index < entries.length; index += 3) {
    assert(['127.0.0.1', 'localhost'].includes(entries[index]));
    assert(isolatedPorts.includes(Number(entries[index + 1]))); assert.equal(entries[index + 2], '0');
  }
  assertIsolatedTunnelSettings(settings);
});

test('extra ports, hosts, file access, force-local and request logging fail closed', () => {
  for (const field of ['forceLocal', 'verbose', 'enableLoggingForApi', 'mitmProxy'])
    assert.throws(() => assertIsolatedTunnelSettings({ ...settings, [field]: true }));
  for (const field of ['folderTesting', 'includeHosts', 'excludeHosts'])
    assert.throws(() => assertIsolatedTunnelSettings({ ...settings, [field]: 'unexpected' }));
  for (const onlyAllow of ['', 'localhost,5001,0', isolatedLocalAllowlist + ',localhost,4185,0',
    isolatedLocalAllowlist + ',192.168.1.1,443,1'])
    assert.throws(() => assertIsolatedTunnelSettings({ ...settings, onlyAllow }));
});

test('the separately approved invitation trial adds only 4185 and never changes the default four-service scope', () => {
  const selected = {...settings, onlyAllow: invitationSignupAllowlist};
  assert.throws(() => assertIsolatedTunnelSettings(selected));
  assertIsolatedTunnelSettings(selected, true);
  assert.throws(() => assertIsolatedTunnelSettings(settings, true));
  for (const onlyAllow of [invitationSignupAllowlist + ',localhost,4186,0',
    invitationSignupAllowlist.replace('127.0.0.1,4185,0', '0.0.0.0,4185,0'),
    invitationSignupAllowlist.replace('localhost,4185,0', 'localhost,4185,1')])
    assert.throws(() => assertIsolatedTunnelSettings({...selected, onlyAllow}, true));
  for (const key of ['forceLocal', 'verbose', 'mitmProxy', 'enableLoggingForApi'])
    assert.throws(() => assertIsolatedTunnelSettings({...selected, [key]: true}, true));
  assert.equal(scopedLocalArguments('/private/config.pipe')[3], isolatedLocalAllowlist);
  assert.equal(scopedLocalArguments('/private/config.pipe', false, undefined, true)[3], invitationSignupAllowlist);
  assert.throws(() => scopedLocalArguments('/private/config.pipe', false, undefined, 'yes'));
});

test('private tunnel checks run in web smoke without starting a paid device', () => {
  const workflow = readFileSync(new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url), 'utf8');
  assert.equal(workflow.split('"tests/browserstack-isolated-tunnel.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/browserstack-isolated-tunnel.test.mjs tests/browserstack-isolated-booking-evidence.test.mjs'));
});
