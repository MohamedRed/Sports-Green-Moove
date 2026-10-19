import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, isAbsolute, dirname, basename } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const childEmergencyGroups = [
  'child-reads-only-its-active-ride-with-an-explicit-empty-contact',
  'separately-verified-parent-choice-persists-its-authorization-provenance',
  'strangers-adults-and-spoofed-child-identities-cannot-read-the-contact',
  'the-child-read-capability-never-enables-self-or-child-contact-writes',
  'a-separate-server-owned-child-account-link-is-required-current-and-revocable',
  'inactive-foreign-and-pre-profile-ride-identities-fail-closed',
  'manager-revocation-blocks-the-child-until-a-new-explicit-parent-verification',
  'removing-the-current-parent-child-relationship-revokes-child-reading',
  'current-parent-role-membership-and-club-status-are-rechecked-on-every-read',
  'missing-or-unrelated-parent-provenance-never-becomes-an-empty-or-guessed-contact',
  'malformed-contact-and-immutable-child-markers-are-refused',
  'legacy-contact-presence-requires-explicit-review-without-fallback-or-data-loss',
  'explicit-parent-removal-is-versioned-and-does-not-authorize-a-phone-destination',
  'recreating-the-verification-club-requires-a-fresh-manager-decision',
  'a-recreated-child-never-inherits-an-old-ride-or-the-prior-contact',
  'other-records-claims-live-rides-and-private-operation-counts-remain-protected',
];
export function validateChildEmergencyServices(report) {
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.scope, 'local-child-read-service-not-native-or-dialer');
  assert.equal(report.testCount, 16);
  assert.deepEqual(report.steps, childEmergencyGroups.map((id) => ({ id, status: 'passed' })));
  for (const key of ['adminClientClosed', 'emulatorCliExitedSuccessfully', 'isolatedEnvironmentDestroyed', 'childAccountLinkPreseeded'])
    assert.equal(report[key], true, key);
  for (const key of ['physicalDevice', 'nativeUiExecuted', 'dialerOpened', 'productionWrites', 'childAccountApprovalFlowExecuted'])
    assert.equal(report[key], false, key);
  assert.equal(report.providerRequests, 0);
  for (const key of ['firstIsolation', 'secondIsolation']) assert.deepEqual(report[key], {
    baselineRecordsPreserved: true, createdRecordCounts: { trips: 1, bookings: 1, rideSessions: 1, notifications: 1, co2Ledger: 0, rewardLedger: 0 },
    otherLiveRidesPreserved: true,
  });
  assert.deepEqual(report.emulatorEndpoints, { host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true });
}
export function validateRetainedChildEmergency(root) {
  const base = resolve(root, 'docs/release/evidence/child-emergency-services-2026-10-19');
  const read = (file) => readFileSync(resolve(base, file));
  const json = (file) => JSON.parse(read(file));
  const report = json('linked/results.json'); validateChildEmergencyServices(report);
  assert.equal(Object.keys(report.sourceFiles).length, 9); assertRetainedSourceFiles(root, report.sourceFiles);
  const { emulatorCliExitedSuccessfully, isolatedEnvironmentDestroyed, emulatorEndpoints, ...attempt } = report;
  assert.deepEqual(json('linked/attempt.json'), attempt);
  const disposal = json('linked/disposal.json');
  assert.equal(disposal.runId, report.runId); assert.equal(disposal.trialPassed, true);
  assert.equal(disposal.isolatedEnvironmentDestroyed, true); assert.deepEqual(disposal.emulatorEndpoints, report.emulatorEndpoints);
  assert(read('linked/transcript.txt').toString().includes('Script exited successfully (code 0)'));
  const preliminary = json('preliminary/results.json');
  assert.equal(preliminary.testCount, 15); assertRetainedSourceFiles(root, preliminary.sourceFiles);
  assert.notEqual(preliminary.runId, report.runId);
  const restored = json('device-preparation-failed/device-restored.json');
  assert.equal(restored.restored, true); assert.equal(restored.verified, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.installAdmin[key], true);
  assert(read('device-preparation-failed/transcript.txt').toString().includes('activateDisposableInstallations'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert(!isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return report;
}
export function validateChildContactComponents(report) {
  assert.equal(report.scope, 'executed-local-child-contact-components-not-child-signin-or-dialer');
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.equal(report.componentCaseCount, 5);
  assert.deepEqual(report.steps, [{ id: 'child-contact-components', status: 'passed' }]);
  assert.equal(report.caseNames.length, 5); assert.equal(new Set(report.caseNames).size, 5);
  for (const key of ['mockedGateway', 'mockedDialer']) assert.equal(report[key], true);
  for (const key of ['actualChildSignIn', 'connectedBackend', 'dialerOpened', 'physicalDevice', 'productionWrites',
    'fullNativeCiVerified', 'visualCompletenessVerified']) assert.equal(report[key], false);
  assert.deepEqual(report.knownVisualDefects, ['child-emergency-readonly-narrow.png', 'child-emergency-readonly-narrow-window.png']);
  assert.equal(Object.keys(report.screenshots).length, 6); assert.match(report.sourceCommit, /^[a-f0-9]{40}$/);
}
export function validateRetainedChildContactComponents(root, source) {
  const directory = dirname(resolve(root, source)), read = (file) => readFileSync(resolve(directory, file));
  const json = (file) => JSON.parse(read(file)), sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = json(basename(source)); validateChildContactComponents(report);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-tests.xml')).testsuite;
  assert.equal(report.testedAt, suite['@_timestamp'] + 'Z');
  const cases = suite.testcase.filter((entry) => entry['@_classname'] === 'be.sportgreenmoove.app.ui.ChildRideEmergencyFlowTest');
  assert.equal(cases.length, 5); assert.deepEqual(cases.map((entry) => entry['@_name']).sort(), report.caseNames);
  for (const entry of cases) for (const key of ['failure', 'error', 'skipped']) assert(!Object.hasOwn(entry, key));
  assertRetainedSourceFiles(root, report.sourceFiles);
  for (const [file, hash] of Object.entries({ ...json('artifact-sha256.json'), ...report.screenshots })) {
    assert.equal(basename(file), file); assert.equal(sha(read(file)), hash, file);
  }
  const restored = json('disposable-store-restore.json'); assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.installAdmin[key], true);
  return report;
}
