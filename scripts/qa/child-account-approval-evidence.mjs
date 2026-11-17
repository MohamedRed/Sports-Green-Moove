import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const approvalGroups = [
  'only-an-existing-child-account-can-create-a-code-without-role-escalation',
  'the-code-is-hashed-at-rest-and-explicit-regeneration-is-rate-limited',
  'a-parent-must-be-separately-verified-before-approving-the-child-device',
  'a-manager-stranger-or-child-cannot-approve-and-client-selected-account-ids-are-refused',
  'an-expired-or-unknown-code-cannot-create-a-link',
  'current-parent-and-child-roles-and-parent-membership-are-rechecked',
  'concurrent-approvals-produce-one-parent-approved-immutable-link-and-an-idempotent-receipt',
  'the-approved-child-account-can-read-its-parent-chosen-contact-for-the-current-ride',
  'a-consumed-code-cannot-rebind-an-account-or-replay-after-the-parent-loses-authority',
  'other-records-account-claims-and-the-owned-ride-remain-unchanged',
];
export function validateChildAccountApprovalReport(report) {
  assert.equal(report.scope, 'local-authenticated-parent-account-approval-not-signup-or-native-navigation');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.testCount, 10);
  assert.deepEqual(report.steps.map(row => row.id), approvalGroups);
  assert(report.steps.every(row => row.status === 'passed'));
  for (const key of ['childAccountApprovalFlowExecuted', 'adminClientClosed', 'emulatorCliExitedSuccessfully', 'isolatedEnvironmentDestroyed'])
    assert.equal(report[key], true, key);
  for (const key of ['childAccountLinkPreseeded', 'nativeUiExecuted', 'physicalDevice', 'productionWrites']) assert.equal(report[key], false, key);
  assert.equal(report.providerRequests, 0); assert.equal(report.emulatorEndpoints.closed, true);
  assert.deepEqual(report.emulatorEndpoints.ports, [9099, 8080, 9000, 5001]);
}
export function validateChildAccountApprovalEvidence(root, metadata) {
  const read = file => readFileSync(resolve(root, file));
  const report = JSON.parse(read(metadata.source)); validateChildAccountApprovalReport(report);
  assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt);
  assertRetainedSourceFiles(root, report.sourceFiles);
  const folder = dirname(metadata.source), manifest = JSON.parse(read(metadata.checksums));
  assert.deepEqual(Object.keys(manifest).sort(), ['ChildAccountLinkStateTest.xml', 'EmergencyRideAccessTest.xml', 'results.json']);
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(read(folder + '/' + file)).digest('hex'), hash);
  for (const [name, count] of [['ChildAccountLinkStateTest', 10], ['EmergencyRideAccessTest', 4]]) {
    const suite = new XMLParser({ ignoreAttributes: false }).parse(read(folder + '/' + name + '.xml')).testsuite;
    assert.equal(Number(suite['@_tests']), count);
    for (const key of ['failures', 'errors', 'skipped']) assert.equal(Number(suite['@_' + key]), 0);
  }
}
