import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeCopyDisconnect(root) {
  const base = resolve(root, 'docs/release/evidence/native-copy-disconnect-2026-10-26');
  const read = name => JSON.parse(readFileSync(resolve(base, name)));
  assertEvidenceBundleChecksums(base);
  const run = read('run.json');
  assert.equal(run.id, 40389650724); assert.equal(run.head_sha, 'ed851b777d31aba91e74274bce872bf1cfa8d527');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const jobs = read('jobs.json').jobs, main = jobs.find(row => row.id === 121806982930);
  assert.equal(main.conclusion, 'failure');
  assert.equal(main.steps.find(row => row.name === 'Run Android Compose UI tests').conclusion, 'failure');
  assert.equal(main.steps.find(row => row.name === 'Upload Android instrumentation reports').conclusion, 'success');
  const focused = jobs.filter(row => row.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(row => row.conclusion === 'success'));
  const artifact = read('artifacts.json').artifacts.find(row => row.id === 12685851499);
  assert.equal(artifact.name, 'android-connected-ui-test-results'); assert.equal(artifact.expired, false);
  const ordinary = read('ordinary-results.json');
  assert.equal(ordinary.caseCount, 231); assert.equal(ordinary.passed, 177); assert.equal(ordinary.skipped, 54); assert.equal(ordinary.failed, 0);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(readFileSync(resolve(base, 'ordinary-tests.xml'), 'utf8')).testsuite;
  assert.equal(suite.testcase.length, 231); assert.equal(suite['@_failures'], '0'); assert.equal(suite['@_errors'], '0');
  assert.equal(suite.testcase.filter(row => 'skipped' in row).length, 54);
  assert.deepEqual(read('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  const primary = read('primary-copy.json'), cleanup = read('cleanup-copy.json'), diagnostics = read('sync-diagnostics.json');
  assert.equal(primary.phase, 'trip-consent-restart'); assert.equal(primary.runId, 'cf039238f2a240e3aadbe6a367514fad');
  assert.equal(primary.status, 1); assert.equal(primary.completed, false); assert.equal(cleanup.completed, true);
  assert.equal(cleanup.runId, primary.runId); assert.equal(diagnostics.runId, primary.runId);
  for (const host of [primary.hostBefore, primary.hostAfter]) {
    assert.equal(host.adbProcesses.length, 4); assert.equal(host.deviceCommandRequested, false);
    assert(!Object.hasOwn(host, 'socketOwnership'), 'Later instrumentation cannot be retroactively claimed');
    assert.deepEqual(host.daemonLog.signals, { killServer: 0, serverRestart: 0, transportOffline: 0, writeFailure: 0 });
  }
  assert.deepEqual(primary.hostBefore.adbProcesses, primary.hostAfter.adbProcesses);
  assert(diagnostics.observations.filter(row => row.stderr?.includes('device offline')).length >= 3);
  const guest = diagnostics.observations.find(row => row.id === 'storage-service-log').value;
  assert.match(guest, /host-16: connection terminated: write failed/); assert.match(guest, /host-17: read thread spawning/);
  const restored = read('device-restore.json'); assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  assert.equal(restored.restoration.installAdmin.originalPolicyRestored, true);
  assert.equal(restored.restoration.installAdmin.authorizationRemoved, true);
}
