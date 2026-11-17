import assert from 'node:assert/strict';
import test from 'node:test';
import {observeHostDnsBeforeLaunch as observe} from '../scripts/qa/observe-host-dns.mjs';

const env = {GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux', SGM_LOCAL_DISPOSABLE_EMULATOR: 'true'};
function fixture() {
  const calls = [];
  return {calls, options: {platform: 'linux', root: '/isolated/repository', exists: () => false,
    mkdir: (...args) => calls.push(['mkdir', ...args]), write: (...args) => calls.push(['write', ...args]),
    inspect: () => {calls.push(['inspect']); return {supported: true, primary: {observed: false}, dnsQueriesIssued: false};}}};
}
for (const [selectedCase, folder] of [['full-matrix', 'store-review-screenshots'],
  ['chat-network-recovery', 'focused-safety-ui/chat-network-recovery']]) test('pre-launch metadata stays in the existing ' + selectedCase + ' artifact', () => {
  const f = fixture(), result = observe(selectedCase, env, f.options);
  assert.equal(result.selectedCase, selectedCase); assert.equal(result.observation.primary.observed, false);
  for (const key of ['deviceCommandsRequested', 'rawLogsRetained', 'addressesRetained', 'newPhoneStarted', 'flowAccepted', 'releaseAccepted'])
    assert.equal(result[key], false);
  const writes = f.calls.filter(row => row[0] === 'write'); assert.equal(writes.length, 1);
  assert.equal(writes[0][1], '/isolated/repository/android/app/build/outputs/' + folder + '/host-dns-before-launch.json');
  assert.deepEqual(writes[0][3], {mode: 0o600, flag: 'wx'});
  assert.equal(f.calls.filter(row => row[0] === 'inspect').length, 1);
  assert.equal(result.observation.dnsQueriesIssued, false);
});
test('unapproved cases, local hosts and an existing receipt stop before any observation or output write', () => {
  for (const [selectedCase, environment, patch] of [['team-draft', env, {}], ['full-matrix', {}, {}],
    ['full-matrix', {...env, GITHUB_ACTIONS: 'false'}, {}], ['full-matrix', {...env, RUNNER_OS: 'macOS'}, {}],
    ['full-matrix', {...env, SGM_LOCAL_DISPOSABLE_EMULATOR: 'false'}, {}], ['full-matrix', env, {platform: 'darwin'}],
    ['full-matrix', {...env, GITHUB_ACTIONS: 'PRIVATE_SECRET'}, {}],
    ['full-matrix', env, {exists: () => true}]]) {
    const f = fixture();
    assert.throws(() => observe(selectedCase, environment, {...f.options, ...patch}), error => !error.message.includes('PRIVATE_SECRET'));
    assert.deepEqual(f.calls, []);
  }
});
