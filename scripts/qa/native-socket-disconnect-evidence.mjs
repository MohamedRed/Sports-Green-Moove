import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const nativeSocketDisconnectFolder = 'docs/release/evidence/native-socket-disconnect-2026-10-26/';
export function validateNativeSocketDisconnect(root) {
  const base = resolve(root, nativeSocketDisconnectFolder), read = file => JSON.parse(readFileSync(resolve(base, file)));
  assertEvidenceBundleChecksums(base);
  const run = read('run.json'); assert.equal(run.id, 40397806734);
  assert.equal(run.head_sha, '4dbffa47c8039ba463bf3d052fb9857496fb0048');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const jobs = read('jobs.json').jobs, main = jobs.find(row => row.id === 121835394777);
  assert.equal(main.conclusion, 'failure');
  assert.equal(main.steps.find(row => row.name === 'Run Android Compose UI tests').conclusion, 'failure');
  assert.equal(main.steps.find(row => row.name === 'Upload Android instrumentation reports').conclusion, 'success');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const artifact = read('artifacts.json').artifacts.find(row => row.id === 12689795072);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.expired, false);
  const ordinary = read('ordinary-results.json');
  assert.equal(ordinary.caseCount, 231); assert.equal(ordinary.passed, 177); assert.equal(ordinary.skipped, 54); assert.equal(ordinary.failed, 0);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(readFileSync(resolve(base, 'ordinary-tests.xml'), 'utf8')).testsuite;
  assert.equal(suite.testcase.length, 231); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite.testcase.filter(row => 'skipped' in row).length, 54);
  assert.deepEqual(read('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const primary = read('primary-copy.json'), cleanup = read('cleanup-copy.json'), prior = read('prior-copy.json');
  assert.equal(primary.phase, 'trip-consent-recovery'); assert.equal(primary.runId, 'b061bb66f0546f6e0b4944384d797a8a');
  assert.equal(primary.status, 1); assert.equal(primary.completed, false); assert.equal(primary.errorCode, null); assert.equal(primary.signal, null);
  assert.equal(prior.phase, 'trip-consent-restart'); assert.equal(prior.status, 0); assert.equal(prior.completed, true);
  assert.equal(cleanup.phase, 'failure-cleanup'); assert.equal(cleanup.status, 0); assert.equal(cleanup.completed, true);
  const views = [prior.hostBefore, prior.hostAfter, primary.hostBefore, primary.hostAfter, cleanup.hostBefore, cleanup.hostAfter];
  const identities = [], connections = [];
  for (const host of views) {
    assert.equal(host.completed, true); assert.equal(host.deviceCommandRequested, false); assert.equal(host.rawLogsRetained, false);
    assert.deepEqual(host.adbProcesses, [{ pid: 3719, startedAtLocal: 'Mon Oct 26 20:48:15 2026' }]);
    assert(!Object.hasOwn(host, 'daemonEvents'), 'Later daemon-event diagnostics cannot be claimed in the original run');
    const owner = host.socketOwnership; assert.equal(owner.completed, true); assert.equal(owner.unavailableProcessCount, 0);
    for (const key of ['deviceCommandRequested', 'rawNetworkTablesRetained', 'argumentsRead', 'environmentRead']) assert.equal(owner[key], false);
    assert.equal(owner.processes.length, 1); const process = owner.processes[0];
    identities.push([process.pid, process.startTicks]);
    const listener = process.connections.filter(row => row.listening);
    assert.deepEqual(listener, [{ inode: '16118', state: '0A', listening: true, localPort: 5037, remotePort: 0,
      localAddress: 'loopback', remoteAddress: 'wildcard' }]);
    const peers = process.connections.filter(row => !row.listening);
    for (const peer of peers) { assert.equal(peer.state, '01'); assert.equal(peer.remotePort, 5555);
      assert.equal(peer.localAddress, 'loopback'); assert.equal(peer.remoteAddress, 'loopback'); }
    connections.push(peers.map(row => [row.localPort, row.remotePort, row.inode]));
  }
  assert.deepEqual(identities, Array(6).fill([3719, '51381']));
  const old = [[45447, 5555, '22879']], next = [[35653, 5555, '40721']];
  assert.deepEqual(connections, [old, old, old, [], next, next]);
  for (const receipt of [prior, cleanup]) assert.equal(receipt.runId, primary.runId);
  assert(prior.recordedAt < primary.recordedAt && cleanup.recordedAt > primary.recordedAt);
  const diagnostics = read('sync-diagnostics.json'); assert.equal(diagnostics.runId, primary.runId);
  assert.equal(diagnostics.observations.filter(row => row.stderr?.includes('device offline')).length, 3);
  const guest = diagnostics.observations.find(row => row.id === 'storage-service-log').value;
  assert.match(guest, /host-20: connection terminated: write failed/); assert.match(guest, /host-21: read thread spawning/);
  const restored = read('device-restore.json'); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.restoration.localPackagesRemoved, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.restoration.installAdmin[key], true);
}
