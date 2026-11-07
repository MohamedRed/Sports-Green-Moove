import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const protocolQueryFolder = 'docs/release/evidence/protocol-query-security-2026-11-06/';
const require = createRequire(import.meta.url), {satisfies} = createRequire(require.resolve('firebase-tools/package.json'))('semver');
export const protocolQueryChanges = {
  'node_modules/express': ['4.22.2', '4.22.3'],
  'node_modules/protobufjs': ['7.6.3', '7.6.6'],
  'node_modules/qs': ['6.15.2', '6.16.2'],
  'node_modules/@protobufjs/inquire': ['1.1.2', null],
  'node_modules/body-parser/node_modules/qs': ['6.16.2', null],
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateProtocolQuerySecurity(root, {includeCompatibility = true} = {}) {
  const base = resolve(root, protocolQueryFolder), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name)), text = name => bytes(name).toString().replace(/\x1b\[[0-9;]*m/g, '');
  assertEvidenceBundleChecksums(base);
  const summary = json('summary.json'); assert.equal(summary.baselineCommit, '385a6a4418848b46f4ea522c2903ee22be8b1ee6');
  assert.equal(summary.scope, 'compatible-parser-patches-and-local-compatibility-not-release-clearance');
  for (const key of ['allSecurityFindingsResolved', 'productionExploitProven', 'productionDeployed', 'realPayments',
    'physicalDeviceAccepted', 'nativeInstabilityRepaired', 'releaseComplete']) assert.equal(summary[key], false, key);
  for (const key of ['directManifestsUnchanged', 'applicationSourcesUnchanged', 'existingRangesRespected']) assert.equal(summary[key], true, key);
  assert.deepEqual(summary.regressionsBefore, {passed: 6, failed: 6}); assert.deepEqual(summary.regressionsAfter, {passed: 12, failed: 0});
  for (const [key, count] of Object.entries({backendUnitCases: 623, allWorkspaceFindingsBefore: 30, allWorkspaceFindingsAfter: 28,
    remainingHighFindings: 5, productionFindingsBefore: 10, productionFindingsAfter: 8})) assert.equal(summary[key], count);
  const before = json('lock-before.json'), after = json('lock-after.json');
  const keys = [...new Set([...Object.keys(before.packages), ...Object.keys(after.packages)])];
  assert.deepEqual(keys.filter(path => !isDeepStrictEqual(before.packages[path], after.packages[path])).sort(), Object.keys(protocolQueryChanges).sort());
  for (const [path, [from, to]] of Object.entries(protocolQueryChanges)) {
    assert.equal(before.packages[path]?.version, from); assert.equal(after.packages[path]?.version ?? null, to);
  }
  for (const path of ['', 'functions', 'admin', 'website']) assert.deepEqual(before.packages[path], after.packages[path]);
  for (const [parent, child] of [['firebase-functions', 'express'], ['firebase-tools', 'express'], ['@grpc/proto-loader', 'protobufjs'], ['stripe', 'qs'], ['body-parser', 'qs']]) {
    const range = after.packages['node_modules/' + parent].dependencies[child];
    assert(satisfies(after.packages['node_modules/' + child].version, range));
  }
  assert.equal(after.packages['node_modules/@firebase/firestore'].version, before.packages['node_modules/@firebase/firestore'].version);
  const snapshots = [
    ['audit-before.json', 30, 25, 5], ['audit-after.json', 28, 23, 5],
    ['production-audit-before.json', 10, 10, 0], ['production-audit-after.json', 8, 8, 0],
  ];
  for (const [name, total, moderate, high] of snapshots) {
    const audit = json(name); assert.deepEqual(audit.metadata.vulnerabilities, {info: 0, low: 0, moderate, high, critical: 0, total});
    for (const dependency of ['protobufjs', 'qs']) assert.equal(Boolean(audit.vulnerabilities[dependency]), name.includes('before'));
  }
  const high = Object.values(json('audit-after.json').vulnerabilities).filter(row => row.severity === 'high').map(row => row.name).sort();
  assert.deepEqual(high, ['@firebase/firestore', '@firebase/firestore-compat', '@firebase/rules-unit-testing', '@grpc/grpc-js', 'firebase'].sort());
  const sources = json('baseline-sources.json'); assert.equal(sources.head, summary.baselineCommit);
  assert.deepEqual(Object.keys(sources.hashes).sort(), ['package.json', 'functions/package.json', 'admin/package.json', 'website/package.json',
    'tests/protocol-query-security.test.mjs', 'tests/helpers/protocol-query-security-probe.mjs'].sort());
  for (const [path, hash] of Object.entries(sources.hashes)) {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(sha(readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'))), hash, path);
  }
  const names = name => [...text(name).matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]);
  assert.equal(names('regressions-before.txt').length, 12); assert.deepEqual(names('regressions-after.txt'), names('regressions-before.txt'));
  assert.match(text('regressions-before.txt'), /# tests 12\n# suites 0\n# pass 6\n# fail 6/);
  assert.match(text('regressions-after.txt'), /# tests 12\n# suites 0\n# pass 12\n# fail 0/);
  assert.match(text('backend-units.txt'), /Tests\s+623 passed \(623\)/);
  for (const name of ['functions', 'admin', 'website']) assert(text('build.txt').includes('@sports-green-moove/' + name));
  assert.match(text('clean-install.txt'), /added 877 packages/);
  assert.match(text('interrupted-services.txt'), /Failed to handle request for function us-central1-cancelTrip/);
  assert.equal(summary.interruptedServiceAttemptAccepted, false); assert.equal(summary.interruptedServiceCauseConfirmed, false);
  if (!includeCompatibility) return summary;
  assert.equal(summary.cloudProviderFlowAccepted, false); assert.equal(summary.serviceReplayAccepted, true);
  const application = json('application-sources.json'); assert.equal(application.baselineCommit, summary.baselineCommit);
  assert.equal(application.allUnchanged, true); assert(application.files.length > 100);
  assert.equal(new Set(application.files.map(row => row.path)).size, application.files.length);
  for (const row of application.files) {assert.match(row.path, /^(?:functions\/src|admin\/src|website\/src|android|ios)\//); assert.match(row.sha256, /^[a-f0-9]{64}$/);}
  for (const [kind, count] of [['payments', 78], ['rules', 219], ['notifications', 20]]) {
    assert.match(text(kind + '.txt'), new RegExp('Tests\\s+' + count + ' passed \\(' + count + '\\)'));
    assert(text(kind + '.txt').includes('Script exited successfully (code 0)'));
  }
  for (const [key, count] of Object.entries({paymentCases: 78, rulesCases: 219, notificationCases: 20})) assert.equal(summary[key], count);
  const services = json('services.json'); assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui'); assert.equal(services.steps.length, 24);
  assert(services.steps.every(row => row.status === 'passed')); assert.equal(summary.serviceGroups, 24);
  assert.equal(services.scenarios.multiSeat.requestedSeats, 2); assert.equal(services.scenarios.ratingRetry.ratingCount, 1);
  assert.equal(services.tripSupplement.finalPaidCents, 550); assert.equal(services.tripSupplement.duplicateEventsOneCredit, true);
  assert.equal(services.tripApplication.originalInvoicesPreserved, true); assert.equal(services.tripApplication.paidBalanceBlocksStart, true);
  assert.equal(services.tripChanges.acceptedParentCount, 2); assert.equal(services.chatResponseLoss.messageCount, 1);
  const disposal = json('services-disposal.json'); assert.equal(disposal.runId, services.runId);
  assert.equal(disposal.isolatedRuntimeDirectoryAbsent, true); assert.equal(disposal.successfulRunnerExit, true);
  assert.equal(disposal.emulatorEndpoints.closed, true); assert.equal(summary.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(disposal.emulatorEndpoints.ports, [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199]);
  assert.match(text('service-transcript.txt'), /Local QA: 24\/24 groups passed/);
  for (const [path, hash] of Object.entries(json('service-source-sha256.json'))) {
    assert(path.startsWith('scripts/qa/')); assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(sha(readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'))), hash);
  }
  return summary;
}
