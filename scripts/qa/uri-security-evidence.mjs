import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const uriSecurityFolder = 'docs/release/evidence/uri-security-2026-11-02/';
export function assertUriSecuritySummary(row) {
  assert.equal(row.scope, 'compatible-real-uri-consumer-security-and-local-flow-regressions-not-production-exploit-or-release');
  for (const [key, value] of Object.entries({checkedAt: '2026-11-02', baselineCommit: 'fbfc7e041aa3c8d086fc7ae5fadbf4c574c365d7',
    beforeVersion: '3.1.2', afterVersion: '3.1.9', changedLockEntries: 1, correctedUriCases: 12, correctedFailuresBefore: 8,
    correctedFailuresAfter: 0, ordinaryControls: 4, existingSecurityCasesPreserved: 18, completeSecurityCasesAfter: 30,
    initialPatchedProbeAssertionFailuresRetained: 2, initialCompatibilityLaunchFailureRetained: true,
    backendUnitCases: 623, rulesCases: 208, paymentCases: 78, childApprovalCases: 10, childInvitationCases: 18,
    sameCorrectedRegressionSources: true, cleanInstallExecuted: true, compatibleConsumerRange: true,
    otherLockEntriesUnchanged: true, declarationsUnchanged: true, publicCapturesAdded: 0})) assert.equal(row[key], value, key);
  assert.deepEqual(row.auditBefore, {total: 38, high: 10, moderate: 28});
  assert.deepEqual(row.auditAfter, {total: 37, high: 9, moderate: 28});
  for (const flag of ['baselineNativeJobPassed', 'productionExploitProven', 'productionRuntimeChanged', 'productionDeployed',
    'parentApprovalPhoneAccepted', 'physicalDeviceAccepted', 'realPayments', 'allSecurityFindingsResolved',
    'nativeInstabilityRepaired', 'postPatchNativeGateAccepted', 'releaseAccepted']) assert.equal(row[flag], false, flag);
}
export function validateUriSecurityEvidence(root) {
  const folder = resolve(root, uriSecurityFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), text = file => bytes(file).toString().replace(/\u001b\[[0-9;]*m/g, '');
  assertEvidenceBundleChecksums(folder);
  const summary = json('summary.json'); assertUriSecuritySummary(summary);
  const phases = ['before-corrected', 'after-corrected'], reports = phases.map(phase => json(phase + '/probe.json'));
  for (const [index, phase] of phases.entries()) {
    const report = reports[index]; assert.equal(report.version, index ? '3.1.9' : '3.1.2');
    assert.equal(report.actualConsumerMatched, true); assert.equal(report.socketFetchAndLookupGuardActive, true);
    assert.equal(report.networkAttempts, 0); assert.equal(report.cases.length, 12);
    assert(report.cases.every(row => !row.unexpectedError)); assert.equal(report.cases.filter(row => !row.passed).length, index ? 0 : 8);
    assert(report.cases.slice(-4).every(row => row.passed)); assert.equal(json(phase + '/complete.json').completed, true);
    assert.equal(json(phase + '/regression-command.json').status, index ? 0 : 1);
    assert.match(text(phase + '/regression.txt'), index ? /^# pass 30$/m : /^# fail 8$/m);
    const audit = json(phase + '/audit.json');
    for (const [key, value] of Object.entries(index ? summary.auditAfter : summary.auditBefore)) assert.equal(audit.metadata.vulnerabilities[key], value);
    assert.equal(audit.metadata.vulnerabilities.critical, 0); assert.equal(!!audit.vulnerabilities['fast-uri'], !index);
    assertRetainedSourceFiles(root, json(phase + '/source-sha256.json'));
  }
  assert.deepEqual(reports[0].cases.map(row => row.id), reports[1].cases.map(row => row.id));
  const names = value => [...value.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]);
  assert.deepEqual(names(text(phases[0] + '/regression.txt')), names(text(phases[1] + '/regression.txt')));
  assert.deepEqual(json(phases[0] + '/source-sha256.json'), json(phases[1] + '/source-sha256.json'));
  assert.deepEqual(json('before/source-sha256.json'), json('after/source-sha256.json'));
  assertRetainedSourceFiles(root, json('before/source-sha256.json'));
  assert.notDeepEqual(json('before/source-sha256.json'), json(phases[0] + '/source-sha256.json'));
  assert.equal(json('before/probe.json').cases.filter(row => !row.passed).length, 8);
  assert.deepEqual(json('after/probe.json').cases.filter(row => !row.passed).map(row => row.id),
    ['equal-rejects-port-authority-injection', 'resolve-keeps-percent-encoded-scheme-inert']);
  assert.equal(json('after/regression-command.json').status, 1); assert(!existsSync(resolve(folder, 'after/complete.json')));
  const before = json(phases[0] + '/lock-snapshot.json'), after = json(phases[1] + '/lock-snapshot.json');
  for (const key of ['lockfileVersion', 'otherPackagesSha256', 'packageCount', 'declarationsSha256']) assert.equal(before[key], after[key]);
  assert.equal(before.fastUri.version, '3.1.2'); assert.equal(after.fastUri.version, '3.1.9');
  const metadata = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['version', 'resolved', 'integrity'].includes(key)));
  assert.deepEqual(metadata(before.fastUri), metadata(after.fastUri)); assert.equal(after.fastUri.dev, true);
  assert.deepEqual(before.consumers, after.consumers); assert.deepEqual(after.consumers, [{path: 'node_modules/ajv', range: '^3.0.1'}]);
  assert.equal(json('maintainer.json').integrity, after.fastUri.integrity);
  for (const [name, count] of [['functions', 623], ['rules', 208], ['payments', 78]])
    assert.match(text('compatibility/' + name + '.txt'), new RegExp('Tests\\s+' + count + ' passed'));
  for (const workspace of ['functions', 'admin', 'website']) assert(text('compatibility/build.txt').includes('@sports-green-moove/' + workspace));
  for (const [directory, names] of [['compatibility', ['build', 'functions', 'rules', 'payments']],
    ['compatibility-followup', ['child-approval', 'child-invitation']]]) for (const name of names) {
    const outcome = json(directory + '/' + name + '-outcome.json');
    assert.equal(outcome.status, 0); assert.equal(outcome.signal, null); assert.equal(outcome.errorCode, null);
    assert.equal(outcome.groupExitVerified, true); assert.equal(outcome.endpoints.closed, true);
  }
  assert.equal(json('compatibility/child-approval-outcome.json').status, 1);
  assert.match(text('compatibility/child-approval.txt'), /!existsSync\(output\)/);
  assert.equal(json('compatibility/disposal.json').completed, false);
  const initialDisposal = json('initial-disposal-followup.json');
  assert.equal(initialDisposal.directoryRemoved, true); assert.equal(initialDisposal.endpoints.closed, true);
  assert.equal(initialDisposal.originalFailureOverridden, false);
  const followup = 'compatibility-followup/'; assert.equal(json(followup + 'complete.json').completed, true);
  const disposal = json(followup + 'disposal.json'); assert.equal(disposal.privateConfigurationRemoved, true);
  assert.equal(disposal.groupsStopped, true); assert.equal(disposal.endpoints.closed, true);
  for (const [name, count] of [['child-approval', 10], ['child-invitation', 18]]) {
    const report = json(followup + name + '-results.json'); assert.equal(report.projectId, 'demo-sgm-local-qa');
    assert.equal(report.steps.length, count); assert(report.steps.every(row => row.status === 'passed'));
    assert.equal(report.nativeUiExecuted, false); assert.equal(report.adminClientClosed, true);
    assert.equal(report.isolatedEnvironmentDestroyed, true); assert.equal(report.emulatorEndpoints.closed, true);
    assert.equal(json(followup + name + '-results.json.artifacts/disposal.json').trialPassed, true);
  }
  const checks = json('baseline-pr-checks.json'); assert.equal(checks.headRefOid, summary.baselineCommit);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.equal(checks.statusCheckRollup.find(row => row.name === 'Android native UI tests').conclusion, 'FAILURE');
  assert.match(text('baseline-native-excerpt.txt'), /EvidenceCollectionError.*trip-consent-recovery/);
  return {correctedUriCases: 12, remainingHighAlerts: 9, childApprovalServiceCases: 10,
    childInvitationServiceCases: 18, parentApprovalPhoneAccepted: false, releaseAccepted: false};
}
