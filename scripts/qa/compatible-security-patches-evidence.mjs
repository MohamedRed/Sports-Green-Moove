import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

const require = createRequire(import.meta.url);
const {satisfies, major} = createRequire(require.resolve('firebase-tools/package.json'))('semver');
export const compatibleSecurityFolder = 'docs/release/evidence/compatible-security-patches-2026-11-03/';
export const compatibleSecurityVersions = {
  'node_modules/@modelcontextprotocol/sdk': ['1.29.0', '1.32.2'],
  'node_modules/baseline-browser-mapping': ['2.10.35', '2.11.35'],
  'node_modules/brace-expansion': ['1.1.15', '1.1.21'],
  'node_modules/browserslist': ['4.28.2', '4.29.5'],
  'node_modules/caniuse-lite': ['1.0.30001797', '1.0.30001820'],
  'node_modules/electron-to-chromium': ['1.5.371', '1.5.473'],
  'node_modules/glob/node_modules/brace-expansion': ['2.1.1', '2.1.7'],
  'node_modules/ip-address': ['10.2.0', '10.7.5'],
  'node_modules/node-releases': ['2.0.47', '2.0.63'],
  'node_modules/readdir-glob/node_modules/brace-expansion': ['2.1.1', '2.1.7'],
  'node_modules/superstatic/node_modules/brace-expansion': ['2.1.1', '2.1.7'],
  'node_modules/update-browserslist-db': ['1.2.3', '1.3.4'],
};
const bindings = [
  ['node_modules/firebase-tools', '@modelcontextprotocol/sdk', 'node_modules/@modelcontextprotocol/sdk'],
  ['node_modules/@babel/helper-compilation-targets', 'browserslist', 'node_modules/browserslist'],
  ['node_modules/express-rate-limit', 'ip-address', 'node_modules/ip-address'],
  ['node_modules/minimatch', 'brace-expansion', 'node_modules/brace-expansion'],
  ...['glob', 'readdir-glob', 'superstatic'].map(name =>
    [`node_modules/${name}/node_modules/minimatch`, 'brace-expansion', `node_modules/${name}/node_modules/brace-expansion`]),
  ...['baseline-browser-mapping', 'caniuse-lite', 'electron-to-chromium', 'node-releases', 'update-browserslist-db']
    .map(name => ['node_modules/browserslist', name, 'node_modules/' + name]),
];
export const compatibleSecurityExcludedClaims = ['baselineWholeNativeGatePassed', 'allSecurityFindingsResolved',
  'productionExploitProven', 'mcpOAuthExchangeTested', 'productionDeployed', 'parentApprovalPhoneAccepted',
  'physicalDeviceAccepted', 'nativeInstabilityRepaired', 'postPatchNativeGateAccepted', 'realPayments',
  'fallbackAdded', 'deadlineChanged', 'releaseAccepted'];

export function assertCompatibleSecuritySummary(summary) {
  assert.equal(summary.scope, 'compatible-installed-security-patches-and-local-service-compatibility-not-release-clearance');
  assert.equal(summary.checkedAt, '2026-11-03');
  assert.equal(summary.baselineCommit, 'e255fe9083d4cda1d7c022512f0864e120bc73cf');
  for (const [key, value] of Object.entries({changedLockEntries: 12, allWorkspaceFindingsBefore: 37, allWorkspaceFindingsAfter: 32,
    highFindingsBefore: 9, highFindingsAfter: 5, moderateFindingsBefore: 28, moderateFindingsAfter: 27,
    criticalFindingsBefore: 0, criticalFindingsAfter: 0, backendUnitCases: 623, invitationServiceCases: 18, providerRequests: 0}))
    assert.equal(summary[key], value, key);
  for (const key of ['directManifestsUnchanged', 'applicationSourcesUnchanged', 'existingDependencyRangesRespected',
    'allWorkspacesBuilt', 'localRuntimeDisposed', 'baselineMainNativeJobPassed']) assert.equal(summary[key], true, key);
  for (const key of compatibleSecurityExcludedClaims) assert.equal(summary[key], false, key);
}

export function validateCompatibleSecurityEvidence(root) {
  const base = resolve(root, compatibleSecurityFolder), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name));
  assertEvidenceBundleChecksums(base);
  const summary = json('summary.json'); assertCompatibleSecuritySummary(summary);
  const before = json('lock-before.json'), after = json('lock-after.json');
  for (const [name, expected] of [['lock-before.json', summary.beforeLockSha256], ['lock-after.json', summary.afterLockSha256]])
    assert.equal(createHash('sha256').update(bytes(name)).digest('hex'), expected);
  assert.deepEqual(Object.keys(before.packages).sort(), Object.keys(after.packages).sort());
  const changed = Object.keys(before.packages).filter(path => !isDeepStrictEqual(before.packages[path], after.packages[path])).sort();
  assert.deepEqual(changed, Object.keys(compatibleSecurityVersions).sort());
  assert.deepEqual(before.packages[''], after.packages['']);
  for (const [path, [from, to]] of Object.entries(compatibleSecurityVersions)) {
    assert.equal(before.packages[path].version, from); assert.equal(after.packages[path].version, to);
    assert.equal(major(from), major(to));
  }
  assert.equal(bindings.length, 12);
  for (const [parent, name, child] of bindings) for (const lock of [before, after])
    assert(satisfies(after.packages[child].version, lock.packages[parent].dependencies[name]), parent + ' -> ' + name);
  const a = json('audit-before.json'), b = json('audit-after.json');
  assert.deepEqual(a.metadata.vulnerabilities, {info: 0, low: 0, moderate: 28, high: 9, critical: 0, total: 37});
  assert.deepEqual(b.metadata.vulnerabilities, {info: 0, low: 0, moderate: 27, high: 5, critical: 0, total: 32});
  assert.equal(a.metadata.dependencies.total, b.metadata.dependencies.total);
  const manifests = json('direct-manifests.json');
  assert.equal(manifests.baselineCommit, summary.baselineCommit); assert.equal(manifests.unchanged, true);
  assert.deepEqual(Object.keys(manifests.sha256).sort(), ['admin/package.json', 'functions/package.json', 'package.json', 'website/package.json']);
  assertRetainedSourceFiles(root, manifests.sha256);
  for (const name of ['@modelcontextprotocol/sdk', 'brace-expansion', 'browserslist', 'ip-address']) {
    assert.equal(a.vulnerabilities[name].severity, 'high'); assert.equal(b.vulnerabilities[name], undefined);
  }
  assert.deepEqual(Object.values(b.vulnerabilities).filter(row => row.severity === 'high').map(row => row.name).sort(),
    ['@firebase/firestore', '@firebase/firestore-compat', '@firebase/rules-unit-testing', '@grpc/grpc-js', 'firebase'].sort());
  const parser = json('parser-comparison.json');
  assert.equal(parser.beforeArchiveMatchesCommittedLock, true);
  assert.equal(parser.beforeArchiveIntegrity, before.packages['node_modules/ip-address'].integrity);
  assert.equal(parser.networkRequestsInParserCases, 0);
  assert.equal(parser.before.linkLocalFea0, false); assert.equal(parser.after.linkLocalFea0, true);
  assert.deepEqual(parser.before.leadingZero, {accepted: true, normalized: '10.0.0.1'});
  assert.deepEqual(parser.after.leadingZero, {accepted: false, normalized: null});
  for (const key of ['linkLocalFe80', 'ordinaryIpv4', 'ordinaryIpv6']) assert.equal(parser.before[key], parser.after[key]);
  assert.match(bytes('backend-units.txt').toString(), /623 passed \(623\)/);
  for (const name of ['functions', 'admin', 'website']) assert(bytes('build.txt').includes('@sports-green-moove/' + name));
  const services = json('invitation-services.json'); assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.steps.length, 18); assert(services.steps.every(step => step.status === 'passed'));
  for (const key of ['nativeUiExecuted', 'browserUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(services[key], false);
  assert.equal(services.providerRequests, 0); assert.equal(services.parentApprovalSeparate, true);
  assert.equal(services.adminClientClosed, true); assert.equal(services.emulatorCliExitedSuccessfully, true);
  assert.equal(services.isolatedEnvironmentDestroyed, true); assert.equal(services.emulatorEndpoints.closed, true);
  assert.deepEqual(services.emulatorEndpoints.ports, [9099, 8080, 9000, 5001]);
  assertRetainedSourceFiles(root, services.sourceFiles);
  const disposal = json('invitation-disposal.json'); assert.equal(disposal.trialPassed, true);
  assert.equal(disposal.runId, services.runId); assert.equal(disposal.isolatedEnvironmentDestroyed, true);
  assert.equal(disposal.emulatorEndpoints.closed, true);
  const job = json('baseline-main-job.json'), checks = json('baseline-checks.json');
  assert.equal(job.id, 126034078019); assert.equal(job.head_sha, summary.baselineCommit); assert.equal(job.conclusion, 'success');
  assert.equal(checks.headRefOid, summary.baselineCommit);
  assert.deepEqual(['SUCCESS', 'SKIPPED', 'FAILURE'].map(c => checks.statusCheckRollup.filter(r => r.conclusion === c).length), [21, 6, 3]);
  return summary;
}
