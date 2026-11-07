import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const dependencyPatchFolder = 'docs/release/evidence/dependency-patch-2026-10-28';
export const dependencyPatchVersions = {
  'node_modules/@google-cloud/pubsub/node_modules/@grpc/grpc-js': ['1.14.4', '1.14.6'],
  'node_modules/google-gax/node_modules/@grpc/grpc-js': ['1.14.4', '1.14.6'],
  'node_modules/firebase-tools/node_modules/form-data': ['4.0.5', '4.0.6'],
  'node_modules/form-data': ['2.5.5', '2.5.6'],
  'node_modules/nanoid': ['3.3.12', '3.3.20'], 'node_modules/postcss': ['8.5.15', '8.5.32'],
  'node_modules/source-map-js': ['1.2.1', '1.2.2'], 'node_modules/vite': ['6.4.3', '6.4.5'],
};
export function assertDependencyPatchSummary(summary) {
  assert.equal(summary.scope, 'installed-dependency-regressions-and-local-business-compatibility-not-production-exploit-or-release-clearance');
  assert.equal(summary.checkedAt, '2026-10-28'); assert.match(summary.baselineCommit, /^[a-f0-9]{40}$/);
  for (const [key, value] of Object.entries({cases: 18, failuresBefore: 12, failuresAfter: 0,
    changedLockEntries: 8, backendUnitCases: 501, serviceGroups: 24, controlledOverlaps: 12, streamingContracts: 7,
    allWorkspaceAuditBefore: 38, allWorkspaceAuditAfter: 33, remainingAllWorkspaceCritical: 2,
    functionsProductionAuditBefore: 16, functionsProductionAuditAfter: 10,
    functionsProductionHighBefore: 6, functionsProductionHighAfter: 0, providerMapRequests: 0})) assert.equal(summary[key], value, key);
  for (const flag of ['sameRegressionSources', 'sameMajorUpdatesOnly', 'businessCodeUnchanged', 'applicationsBuilt', 'localRuntimeDisposed'])
    assert.equal(summary[flag], true, flag);
  for (const flag of ['productionExploitProven', 'allSecurityFindingsResolved', 'productionDeployed', 'physicalUiVerified',
    'realPayments', 'releaseComplete', 'nativeNetworkPreparationCauseProven', 'nativeFailureRepairedByDependencyPatch'])
    assert.equal(summary[flag], false, flag);
}
export function validateDependencyPatchEvidence(root, record = {source: dependencyPatchFolder + '/summary.json',
  checksums: dependencyPatchFolder + '/artifact-sha256.json', checkedAt: '2026-10-28'}) {
  const base = dirname(resolve(root, record.source)), text = name => readFileSync(resolve(base, name), 'utf8');
  const json = name => JSON.parse(text(name));
  assertEvidenceBundleChecksums(base); const summary = json('summary.json'); assertDependencyPatchSummary(summary);
  assert.equal(record.checkedAt, summary.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
  const before = text('regression-before.txt'), after = text('regression-after.txt');
  const names = text => [...text.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]);
  assert.equal(names(before).length, 18); assert.deepEqual(names(before), names(after));
  assert.match(before, /^# fail 12$/m); assert.match(before, /injectedHeader: true/);
  assert.match(before, /SIGABRT|ETIMEDOUT/); assert.match(after, /^# pass 18$/m); assert.match(after, /^# fail 0$/m);
  const old = json('lock-before.json').packages, next = json('lock-after.json').packages;
  const changed = [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter(key => JSON.stringify(old[key]) !== JSON.stringify(next[key])).sort();
  assert.deepEqual(changed, Object.keys(dependencyPatchVersions).sort());
  for (const [path, [from, to]] of Object.entries(dependencyPatchVersions)) {
    assert.equal(old[path].version, from); assert.equal(next[path].version, to);
    assert.equal(from.split('.')[0], to.split('.')[0]); assert.equal(from.split('.')[1], to.split('.')[1]);
  }
  const auditBefore = json('audit-all-before.json'), auditAfter = json('audit-all-after.json');
  assert.equal(auditBefore.metadata.vulnerabilities.total, 38); assert.equal(auditAfter.metadata.vulnerabilities.total, 33);
  assert.equal(auditAfter.metadata.vulnerabilities.critical, 2);
  for (const name of ['form-data', 'nanoid', 'postcss', 'source-map-js', 'vite']) {
    assert(auditBefore.vulnerabilities[name]); assert.equal(auditAfter.vulnerabilities[name], undefined);
  }
  const functionsBefore = json('audit-functions-production-before.json'), functionsAfter = json('audit-functions-production-after.json');
  assert.equal(functionsBefore.metadata.vulnerabilities.total, 16); assert.equal(functionsBefore.metadata.vulnerabilities.high, 6);
  assert.equal(functionsAfter.metadata.vulnerabilities.total, 10); assert.equal(functionsAfter.metadata.vulnerabilities.high, 0);
  assert.equal(functionsAfter.metadata.vulnerabilities.moderate, 10);
  assert.match(text('backend-units.txt'), /501 passed \(501\)/);
  for (const workspace of ['functions', 'admin', 'website']) assert(text('build.txt').includes('@sports-green-moove/' + workspace));
  assert.match(text('streaming.txt'), /^# pass 7$/m); assert.match(text('streaming.txt'), /^# fail 0$/m);
  const services = json('services.json'); assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.steps.length, 24); assert(services.steps.every(step => step.status === 'passed'));
  const contention = json('contention.json'); assert.equal(contention.passed, true); assert.equal(contention.rounds, 12);
  assert.equal(contention.cases.length, 12); assert(contention.cases.every(row => !row.gateTimedOut && row.notificationCount === 1));
  for (const row of contention.cases) {
    assert.equal(row.outcomes.length, 2); assert.equal(row.outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = row.outcomes.filter(result => result.status === 'rejected'); assert.equal(rejected.length, 1);
    assert(['aborted', 'failed-precondition'].includes(rejected[0].code));
    if (row.tripStatus === 'cancelled') {
      assert.equal(row.bookingStatus, 'cancelled'); assert.equal(row.seatsAvailable, 4); assert.equal(row.cancellationReceiptExists, true);
    } else {
      assert.equal(row.tripStatus, 'published'); assert.equal(row.bookingStatus, 'approved');
      assert.equal(row.seatsAvailable, 3); assert.equal(row.cancellationReceiptExists, false);
    }
  }
  assert.equal(contention.livePayment, false); assert.equal(contention.productionDeployed, false);
  for (const file of ['services-completion.txt', 'contention-completion.txt']) assert.match(text(file), /Script exited successfully \(code 0\)/);
  const cleanup = json('disposal.json'); assert.equal(cleanup.commandExitCodes.services, 0); assert.equal(cleanup.commandExitCodes.contention, 0);
  assert.equal(cleanup.endpointsClosed, true); assert.equal(cleanup.ownedProcessesAbsent, true);
  const marker = json('previous-ci/network-marker.json'), job = json('previous-ci/job.json');
  assert.equal(job.head_sha, summary.baselineCommit); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(marker.completed, false); assert.equal(marker.failedPhase, 'network-preparation'); assert.deepEqual(marker.network, []);
  assert.deepEqual(marker.preparationFailure.activeInternetTransports, ['cellular']);
  assert.deepEqual(marker.preparationFailure.internetTransports, ['wifi', 'cellular']);
  assert.equal(marker.preparationFailure.backendReachable, true);
  assert.equal(marker.cellularRequestReleased, true); assert.equal(marker.wifiRequestReleased, true);
  const restoration = json('previous-ci/device-restoration.json'); assert.equal(restoration.verified, true);
  assert.equal(restoration.scope, 'single-case-device-restoration-not-flow-proof');
  assert.match(text('previous-ci/instrumentation.txt'), /LocalChatNetworkFlowTest.kt:82/);
  const run = json('previous-ci/terminal-run.json'); assert.equal(run.headSha, summary.baselineCommit);
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  const ordinary = new XMLParser({ignoreAttributes: false}).parse(text('previous-ci/ordinary-components.xml')).testsuite;
  assert.equal(Number(ordinary['@_tests']), 237); assert.equal(Number(ordinary['@_skipped']), 54);
  assert.equal(Number(ordinary['@_failures']), 1); assert.equal(Number(ordinary['@_errors']), 0);
  const failures = [].concat(ordinary.testcase).filter(row => row.failure); assert.equal(failures.length, 1);
  assert.equal(failures[0]['@_classname'], 'be.sportgreenmoove.app.ui.TeamConversationFlowTest');
  assert.equal(failures[0]['@_name'], 'anUnconfirmedSendRetriesTheSameIntentAndOnlyOneMessageIsAdded');
  assert.match(text('previous-ci/ordinary-instrumentation.txt'), /Blank test capture rejected/);
  const exits = json('previous-ci/native-suite-status.json');
  assert.equal(exits.ordinaryTests, 1); assert.equal(exits.componentEvidence, 0); assert.equal(exits.localReplay, 1);
  const copy = json('previous-ci/primary-copy.json'); assert.equal(copy.phase, 'trip-consent-recovery');
  assert.equal(copy.status, 1); assert.equal(copy.completed, false);
  assertRetainedSourceFiles(root, json('source-files.json')); return summary;
}
