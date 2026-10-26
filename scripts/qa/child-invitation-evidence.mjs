import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';
import { validateChildInvitationBindingEvidence } from './child-invitation-binding-evidence.mjs';
import { validateChildInvitationBrowserEvidence } from './child-invitation-browser-evidence.mjs';
import { validateChildInvitationNativeEvidence } from './child-invitation-native-evidence.mjs';

export const childInvitationFolder = 'docs/release/evidence/child-invitation-2026-10-26/';
export function validateChildInvitationReport(report) {
  assert.equal(report.scope, 'isolated-invitation-services-units-and-mocked-web-review-not-connected-phone-or-production');
  assert.equal(report.serviceGroups, 18); assert.equal(report.nativeUnitCases, 10); assert.equal(report.functionUnitCases, 11);
  assert.equal(report.instrumentedCasesCompiled, 3); assert.equal(report.rulesCasesPassed, 207);
  for (const field of ['instrumentedCasesExecuted', 'physicalDevice', 'nativeShareChooserOpened', 'connectedBrowserSignup',
    'automaticParentApproval', 'newScreenshotsAccepted', 'applicationDeployed', 'signupUrlPublished', 'productionWrites', 'releaseAccepted'])
    assert.equal(report[field], false, field);
  assert.equal(report.webReview.scope, 'actual-component-with-fake-submit-handler-not-account-creation');
  assert.deepEqual(report.webReview.mobileFrameWidths, [390, 320]);
}

export function validateChildInvitationEvidence(root) {
  validateChildInvitationBindingEvidence(root);
  validateChildInvitationBrowserEvidence(root);
  validateChildInvitationNativeEvidence(root);
  const read = path => readFileSync(resolve(root, childInvitationFolder, path));
  const report = JSON.parse(read('verification.json')); validateChildInvitationReport(report);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const services = JSON.parse(read('services.json')), disposal = JSON.parse(read('disposal.json'));
  assert.equal(services.scope, 'isolated-authenticated-invitation-provisioning-and-approval-not-browser-or-phone-ui');
  assert.equal(services.projectId, 'demo-sgm-local-qa'); assert.equal(services.testCount, 18); assert.equal(services.steps.length, 18);
  assert(services.steps.every(step => step.status === 'passed')); assert.equal(new Set(services.steps.map(step => step.id)).size, 18);
  assert.equal(services.injectedInterruptionScenarios, 2); assert.equal(services.childAccountProvisioned, true);
  assert.equal(services.parentApprovalSeparate, true); assert.equal(services.nativeUiExecuted, false);
  assert.equal(services.browserUiExecuted, false); assert.equal(services.physicalDevice, false); assert.equal(services.productionWrites, false);
  assert.equal(services.providerRequests, 0); assert.equal(services.adminClientClosed, true);
  assert.equal(services.emulatorCliExitedSuccessfully, true); assert.equal(services.isolatedEnvironmentDestroyed, true);
  for (const [file, hash] of Object.entries(services.sourceFiles)) assert.equal(report.sourceFiles[file], hash);
  assert.equal(disposal.runId, services.runId); assert.equal(disposal.trialPassed, true);
  assert.equal(disposal.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(services.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
  assert.deepEqual(disposal.emulatorEndpoints, services.emulatorEndpoints);
  const failed = JSON.parse(read('failed-preparation-disposal.json'));
  assert.equal(failed.trialPassed, false); assert.equal(failed.isolatedEnvironmentDestroyed, true);
  assert.notEqual(failed.runId, services.runId);
  const units = JSON.parse(read('functions-units.json'));
  assert.equal(units.success, true); assert.equal(units.numTotalTests, 11); assert.equal(units.numPassedTests, 11);
  assert.equal(units.numFailedTests, 0); assert.equal(units.testResults.length, 2);
  assert(units.testResults.every(file => file.status === 'passed' && file.assertionResults.every(row => row.status === 'passed')));
  const native = new XMLParser({ ignoreAttributes: false }).parse(read('native-units.xml').toString()).testsuite;
  assert.equal(native['@_name'], 'be.sportgreenmoove.app.ui.ChildInvitationStateTest');
  assert.deepEqual(['tests', 'failures', 'errors', 'skipped'].map(key => Number(native['@_' + key])), [10, 0, 0, 0]);
  assert.equal(native.testcase.length, 10);
  assert.equal((read('native-ui-signatures.txt').toString().match(/public final void \w+\(\);/g) ?? []).length, 3);
  assert(read('rules-output.txt').toString().includes('207 passed (207)'));
  const prior = JSON.parse(read('prior-pr.json')), job = JSON.parse(read('prior-people-job.json'));
  assert.equal(prior.headRefOid, '4454cc105c0eb073f8b84228e4e09ada4b2a667e');
  assert(prior.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert(prior.statusCheckRollup.some(row => row.name === 'People and safety service smoke' && row.conclusion === 'CANCELLED'));
  assert(prior.statusCheckRollup.some(row => row.name === 'Functions, admin, and website smoke' && row.conclusion === 'FAILURE'));
  assert.equal(job.id, 121701133944); assert.equal(job.conclusion, 'cancelled');
  assert(job.steps.some(step => step.name === 'Install media inspection tools' && step.conclusion === 'cancelled'));
  assert.equal(job.steps.find(step => step.name === 'Test child contact discovery through verified-parent approval').conclusion, 'skipped');
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['services.json', 'disposal.json', 'failed-preparation-disposal.json', 'functions-units.json',
    'native-units.xml', 'native-ui-signatures.txt', 'prior-pr.json', 'prior-people-job.json', 'rules-output.txt',
    'verification.json', 'visual-harness.txt'].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash);
}
