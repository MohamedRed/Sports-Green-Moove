import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const invitationRecheckFolder = 'docs/release/evidence/child-invitation-recheck-2026-10-31/';
export function validateInvitationServiceRecheck(report, disposal, baseline) {
  assert.equal(report.scope, 'isolated-authenticated-invitation-provisioning-and-approval-not-browser-or-phone-ui');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.match(report.testedAt, /^2026-10-31T/);
  assert.equal(report.testCount, 18); assert.deepEqual(report.steps, baseline.steps);
  assert.equal(report.injectedInterruptionScenarios, 2);
  for (const key of ['childAccountProvisioned', 'parentApprovalSeparate', 'adminClientClosed',
    'emulatorCliExitedSuccessfully', 'isolatedEnvironmentDestroyed']) assert.equal(report[key], true, key);
  for (const key of ['nativeUiExecuted', 'browserUiExecuted', 'physicalDevice', 'productionWrites',
    'bindingBypassObserved', 'defaultParentPromotionObserved']) assert.equal(report[key], false, key);
  assert.equal(report.providerRequests, 0);
  assert.deepEqual(report.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  assert.equal(disposal.projectId, report.projectId); assert.equal(disposal.runId, report.runId);
  assert.equal(disposal.scope, 'owned-runtime-disposal-not-flow-verification');
  assert.equal(disposal.trialPassed, true); assert.equal(disposal.isolatedEnvironmentDestroyed, true);
  assert.deepEqual(disposal.emulatorEndpoints, report.emulatorEndpoints);
}

export function validateChildInvitationRecheck(root) {
  const folder = resolve(root, invitationRecheckFolder);
  assertEvidenceBundleChecksums(folder);
  const read = name => JSON.parse(readFileSync(resolve(folder, name)));
  const report = read('services.json'), context = read('context.json');
  assert.equal(context.sourceCommit, '9b058d6276b337b07ec3e4a60ba9b185cf687744');
  assert.equal(context.scope, 'local-service-recheck-not-phone-or-release');
  const baseline = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/child-invitation-2026-10-26/services.json')));
  validateInvitationServiceRecheck(report, read('disposal.json'), baseline);
  assertRetainedSourceFiles(root, report.sourceFiles);
}
