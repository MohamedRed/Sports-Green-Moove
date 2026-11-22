import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { emergencyPhonePhases, verifyEmergencyPhoneCheckpoint } from '../scripts/qa/manual-emergency-checkpoints.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const identity = { contactIds: ['adult', 'child'], childId: 'qa-child', childInstanceId: 'a'.repeat(64) };
function stateAt(index) {
  const contacts = [], operations = [];
  const add = (id, kind, subjectId, revision, contact, extra = {}) => {
    contacts.push({ id, kind, subjectId, revision, contact, lastActorUserId: 'sgm-qa-parent', ...extra });
    for (let version = 1; version <= revision; version++) operations.push({ contactId: id, revision: version, actorUserId: 'sgm-qa-parent' });
  };
  if (index >= 1) add('adult', 'self', 'sgm-qa-parent', index >= 6 ? 2 : 1,
    index >= 6 ? null : { name: 'Contact adulte QA', phone: '+12025550123' });
  if (index >= 3) add('child', 'child', identity.childId, 1, { name: 'Contact enfant QA', phone: '+12025550124' },
    { childInstanceId: identity.childInstanceId });
  return { contacts, operations, guardian: { status: index >= 4 ? 'revoked' : 'verified', revision: index >= 4 ? 3 : 2,
    lastActorUserId: 'sgm-qa-club-manager' } };
}
test('eight exact persisted checkpoints preserve distinct identity and do not infer phone or dialer outcomes', () => {
  for (const [index, phase] of emergencyPhonePhases.entries()) {
    const result = verifyEmergencyPhoneCheckpoint(phase, stateAt(index), identity);
    assert.equal(result.phase, phase); assert.equal(result.physicalDevice, undefined); assert.equal(result.dialerOpened, undefined);
  }
});
test('a wrong child identity, contact, actor, revision or extra operation cannot pass', () => {
  for (const mutate of [
    (s) => { s.contacts[1].childInstanceId = 'b'.repeat(64); },
    (s) => { s.contacts[1].contact.phone = '+12025550123'; },
    (s) => { s.contacts[0].lastActorUserId = 'another'; },
    (s) => { s.contacts[0].revision = 2; },
    (s) => { s.operations.push(s.operations[0]); },
    (s) => { s.guardian.lastActorUserId = 'sgm-qa-parent'; },
  ]) { const state = stateAt(3); mutate(state); assert.throws(() => verifyEmergencyPhoneCheckpoint('child-saved', state, identity)); }
});
test('unchanged reads and revocation/removal boundaries cannot skip required stored mutations', () => {
  assert.throws(() => verifyEmergencyPhoneCheckpoint('child-revoked', stateAt(3), identity));
  assert.throws(() => verifyEmergencyPhoneCheckpoint('adult-removed', stateAt(5), identity));
  assert.throws(() => verifyEmergencyPhoneCheckpoint('unknown', stateAt(0), identity));
});
test('manual replay always cleans on EOF or failure and only explicit ordered finish can complete', () => {
  const source = readFileSync(new URL('../scripts/qa/manual-emergency-session.mjs', import.meta.url), 'utf8');
  for (const guard of ['statSync(sessionPath).mode & 0o077', 'completed = false', 'for await (const command of input)',
    'emergencyPhonePhases[checkpoints.length]', 'checkpoints.length, 4', 'managerRevokeRequestId, undefined',
    'verifyEmergencyNativeFixture(fixture, { managerRevokeRequestId })', 'await cleanupEmergencyNativeFixture(fixture)',
    'completed: completed && !failure', 'physicalUiProvenByThisReport: false', 'dialerHandoffProvenByThisReport: false'])
    assert(source.includes(guard), guard);
  assert(!source.includes("call('saveEmergencyContact'"));
});
test('the interrupted preparation stays incomplete with exact source/artifact bindings and separate teardown', () => {
  const base = '../docs/release/evidence/phone-emergency-preparation-2026-10-19/';
  const read = (file) => readFileSync(new URL(base + file, import.meta.url));
  const report = JSON.parse(read('session-results.json'));
  assert.equal(report.completed, false); assert.deepEqual(report.checkpoints, []);
  assert.equal(report.fixtureCleanupVerified, true); assert.equal(report.verificationPreseeded, false);
  assert.equal(report.physicalUiProvenByThisReport, false); assert.equal(report.dialerHandoffProvenByThisReport, false);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  const cleanup = JSON.parse(read('teardown.json'));
  assert.equal(cleanup.privateSessionRemoved, true); assert.equal(cleanup.helperProcessesExited, true);
  assert.equal(cleanup.phoneReleasedThroughUi, true); assert.equal(cleanup.phoneCredentialsEntered, false);
  assert.equal(cleanup.uiCheckpointsPassed, 0);
  assert.deepEqual(Object.keys(cleanup.ports).map(Number).sort((a, b) => a - b), [4199, 5001, 8080, 9000, 9099, 45454]);
  assert(Object.values(cleanup.ports).every((value) => value === 'refused'));
  for (const [file, expected] of Object.entries(JSON.parse(read('artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), expected);
  for (const file of ['backend-ci.yml', 'native-ci.yml', 'web-integration-smoke.yml'])
    assert(readFileSync(new URL('../.github/workflows/' + file, import.meta.url), 'utf8').includes('tests/manual-emergency-checkpoints.test.mjs'));
});
