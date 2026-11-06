import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {validateChatNetworkRecheck} from './chat-network-recheck-evidence.mjs';

export const network959Folder = 'docs/release/evidence/native-network-959-comparison-2026-11-06/';
export const network959Identity = Object.freeze({folder: 'docs/release/evidence/chat-network-959e70b-2026-11-06/',
  head: '959e70b41abb039037f94e6eeec8402b597b5bff', runId: '6c1ce27816e05732b4e553554803dcc6', date: '2026-11-06',
  jobId: 128006497904, workflowId: 42251215886, artifactId: 13520139105});
export const network959Archives = Object.freeze({
  main: {id: 13522187520, bytes: 33156371, sha256: '690f364b01b825e32d4b7defec886cde199d971c6df8455f81ecd2a6e60f17be'},
  focused: {id: 13520139105, bytes: 615893, sha256: '68fc07aec6b4a176d4d4340ddf80d1ca53cfb28b4acb6b45aa792d3681706c6b'},
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateNetwork959Evidence(root) {
  const base = resolve(root, network959Folder), bytes = name => readFileSync(resolve(base, name)), json = name => JSON.parse(bytes(name));
  assertEvidenceBundleChecksums(base);
  const focused = validateChatNetworkRecheck(root,
    {source: network959Identity.folder + 'chat-network-recovery-results.json', checkedAt: network959Identity.date}, network959Identity);
  const report = json('summary.json'); assert.equal(report.sourceCommit, network959Identity.head);
  assert.equal(report.focusedRecoveryAccepted, true); assert.equal(report.mainFailedPhase, 'network-preparation');
  for (const key of ['mainRadioCutExecuted', 'wholeNativeGateAccepted', 'underlyingDnsCauseConfirmed', 'dnsRepaired',
    'physicalDeviceAccepted', 'releaseComplete', 'providerReadinessAccepted']) assert.equal(report[key], false, key);
  const main = json('main-ui.json'); assert.equal(main.completed, false); assert.equal(main.failedPhase, 'network-preparation');
  assert.equal(main.runId, 'b7e679d38e2c679372c9190d7248ebe2'); assert.deepEqual(main.network, []);
  assert.equal(main.cellularRequestReleased, true); assert.equal(main.wifiRequestReleased, true);
  for (const sample of [main.initialNetwork, main.preparation, main.preparationFailure]) {
    assert.equal(sample.backendReachable, true); assert.equal(sample.hasDefaultDataSubscription, true);
    assert.equal(sample.internetNetworkCount, 2); assert.deepEqual(sample.activeInternetTransports, ['cellular']);
    assert.equal(sample.capabilityObservation.available.find(row => row.transports.includes('wifi')).validated, false);
    assert.equal(sample.capabilityObservation.active.validated, true);
  }
  const subscriptions = json('main-subscriptions.json'); assert.equal(subscriptions.defaultSubscriptionValid.defaultDataSubId, true);
  const history = json('main-validation-before.json'); assert.equal(history.newProbesIssued, false); assert.equal(history.atomicObservation, false);
  const wifi = history.groups.find(row => row.transports.includes('wifi'));
  assert(wifi.events.some(row => row.probe === 'dns' && row.result === 'failure'));
  assert(wifi.events.some(row => row.errorKind === 'dns-resolution'));
  assert.equal(history.groups.find(row => row.transports.includes('cellular')).events.some(row => row.httpStatus === 204), true);
  const restore = json('main-device-restore.json'); assert.equal(restore.verified, true);
  assert.equal(restore.restoration.localPackagesRemoved, true); assert.equal(restore.restoration.installAdmin.originalPolicyRestored, true);
  assert.equal(json('main-host-shutdown.json').finalState, 'gone');
  assert.deepEqual(json('main-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1});
  const ordinary = json('main-ordinary-results.json'); assert.equal(ordinary.caseCount, 354); assert.equal(ordinary.passed, 299);
  assert.equal(ordinary.skipped, 55); assert.equal(ordinary.failed, 0);
  const job = json('main-job.json'); assert.equal(job.id, 128006497424); assert.equal(job.head_sha, network959Identity.head);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  for (const [kind, expected] of Object.entries(network959Archives)) {
    const archive = json(kind + '-archive.json'); assert.equal(archive.artifactId, expected.id);
    assert.equal(archive.sha256, expected.sha256); assert.equal(archive.bytes, expected.bytes);
    assert.equal(archive.members.length, kind === 'main' ? 11 : 10);
    for (const row of archive.members) {
      assert(!row.file.includes('..') && !row.file.startsWith('/'));
      assert.equal(row.destination, kind === 'main' ? network959Folder : network959Identity.folder);
      const original = readFileSync(resolve(root, row.destination, row.file));
      assert.equal(sha(original), row.sha256); assert.equal(original.length, row.bytes);
    }
  }
  const focusUi = JSON.parse(readFileSync(resolve(root, network959Identity.folder, 'local-chat-network-ui.json')));
  assert.equal(focusUi.parentDraftRestored, true); assert.equal(focused.network.duplicateMessages, 0);
  const prerequisite = json('focused-wifi-readiness.json'); assert.equal(prerequisite.ready, true); assert.equal(prerequisite.initialReady, false);
  assert.equal(prerequisite.sampleCount, 2); assert.equal(prerequisite.budgetMs, 180000);
  for (const key of ['settingsChanged', 'radioChanged', 'newProbesIssued', 'rootCauseFixed', 'flowCompleted']) assert.equal(prerequisite[key], false);
  assert.match(bytes('regression-before.txt').toString(), /# tests 4\n# suites 0\n# pass 1\n# fail 3/);
  assert.match(bytes('regression-after.txt').toString(), /# tests 4\n# suites 0\n# pass 4\n# fail 0/);
  const health = json('callback-health.json'); assert.equal(health.scope, 'read-only-public-callback-health-not-payment-or-onboarding');
  assert.equal(health.productionWrites, false); assert.equal(health.paymentsCreated, false); assert.equal(health.rootCauseConfirmed, false);
  assert.equal(health.observations.length, 2); assert(health.observations.every(row => row.passed && row.httpStatus === 204));
  assert.equal(json('callback-timeout.json').failureKind, 'timeout');
  const sources = json('source-sha256.json');
  for (const entries of Object.values(sources)) for (const [path, hash] of Object.entries(entries)) {
    assert(path.startsWith('scripts/') || path.startsWith('tests/') || path.startsWith('android/') || path.startsWith('.github/'));
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(sha(readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'))), hash);
  }
  const source = (kind, path) => readFileSync(resolve(root, 'docs/release/evidence/source-archive', sources[kind][path] + '.txt'), 'utf8');
  const script = 'scripts/run-android-ui-tests-and-collect-screenshots.sh';
  const line = 'node "$repo_root/scripts/qa/wait-disposable-wifi.mjs" "$output_dir/network-readiness" || exit 1\n';
  assert(!source('baseline', script).includes('wait-disposable-wifi.mjs'));
  assert.equal(source('candidate', script).split(line).length, 2);
  assert.equal(source('candidate', script).replace(line, ''), source('baseline', script));
  for (const path of ['android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalChatNetworkFlowTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalInitialNetworkObservation.kt',
    'scripts/qa/disposable-wifi-readiness.mjs', 'tests/full-matrix-network-prerequisite.test.mjs'])
    assert.equal(sources.baseline[path], sources.candidate[path]);
  assert.equal(report.passivePreflightAddedToFullMatrix, true); assert.equal(report.newMedia, 0);
  return report;
}
