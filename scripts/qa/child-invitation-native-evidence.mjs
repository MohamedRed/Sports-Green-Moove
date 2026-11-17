import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseAndroidJUnitTranscript } from './android-junit-transcript.mjs';

export function validateChildInvitationNativeEvidence(root) {
  const folder = 'docs/release/evidence/child-invitation-native-2026-10-26/';
  const read = file => readFileSync(resolve(root, folder, file));
  const result = JSON.parse(read('ordinary-results.json'));
  const transcript = parseAndroidJUnitTranscript(read('ordinary-instrumentation.txt').toString());
  for (const key of Object.keys(transcript)) assert.deepEqual(result[key], transcript[key]);
  assert.deepEqual([result.caseCount, result.passed, result.skipped, result.failed], [231, 177, 54, 0]);
  assert.equal(result.physicalDeviceAccepted, false); assert.equal(result.productionWritesAccepted, false);
  const cases = result.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.ChildInvitationFlowTest');
  assert.deepEqual(cases.map(row => row.name).sort(), ['aParentCreatesThenSharesOnlyTheReturnedLinkWithoutShowingItsSecret',
    'aConsumedInvitationIsNotDisplayedAsReusableOnALargeTextSmallScreen', 'anExplicitRevocationDisablesTheShareAction'].sort());
  assert(cases.every(row => row.status === 'passed'));
  const run = JSON.parse(read('native-run.json'));
  assert.equal(run.headSha, 'f773b3df5f656103323ab51a8db83b124db7beb9');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.jobs.find(row => row.name === 'Android native UI tests').conclusion, 'failure');
  const failure = JSON.parse(read('capture-failure.json'));
  assert.equal(failure.phase, 'trip-change-parent-confirmation'); assert.equal(failure.status, 1);
  assert.equal(failure.completed, false); assert.equal(failure.signal, null);
  assert.equal(failure.scope, 'local-adb-file-sync-command-not-flow-verification');
  const restoration = JSON.parse(read('device-restored.json'));
  assert.equal(restoration.restored, true); assert.equal(restoration.verified, true);
  assert.equal(restoration.restoration.localPackagesRemoved, true);
  for (const field of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored'])
    assert.equal(restoration.restoration.installAdmin[field], true);
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['README.md', 'ordinary-results.json', 'ordinary-instrumentation.txt',
    'device-restored.json', 'capture-failure.json', 'native-run.json'].sort());
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
}
