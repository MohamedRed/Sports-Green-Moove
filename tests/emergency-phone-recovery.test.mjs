import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { verifyPhoneContactRecovery } from '../scripts/qa/emergency-phone-recovery-evidence.mjs';
import { validateEmergencyPhoneArtifacts, validateEmergencyDialerPreflight } from '../scripts/qa/emergency-phone-retained-evidence.mjs';
import { content } from '../partner-portal/content.mjs';
import { archivedProgress } from '../partner-portal/progress-archive.mjs';
import { recentProgress } from '../partner-portal/recent-progress.mjs';

const preflight = 'docs/release/evidence/emergency-dialer-preflight-2026-10-21/results.json';
test('a failed system-dialer prerequisite adds no accepted app capture, handoff or release evidence', () => {
  const run = validateEmergencyDialerPreflight(process.cwd(), preflight);
  assert.equal(run.result, 'blocked'); assert.deepEqual(run.publishedCaptures, []);
  const flow = content.flows.find(item => item.id === 'emergency-contact');
  assert.equal(flow.status, 'partial'); assert.equal(flow.dialerPreflight.source, preflight);
  assert(flow.images.every(image => !image.file.includes('preflight')));
  const manifest = JSON.parse(readFileSync(new URL('../docs/release/evidence-manifest.json', import.meta.url)));
  assert.equal(manifest.storeReviewEvidence.items.find(item => item.id === 'emergency_contact_action_screenshot').status, 'pending');
  assert.equal(archivedProgress.length, 85);
  assert(archivedProgress.every(item => item.date <= '2026-10-18'));
  assert.equal(recentProgress.length, 153);
  assert.deepEqual(content.updates.slice(0, recentProgress.length), recentProgress);
});
for (const [file, key, value] of [['results.json', 'dialerHandoffVerified', true],
  ['results.json', 'rootCauseConfirmed', true], ['results.json', 'storeReviewAccepted', true],
  ['results.json', 'publishedCaptures', ['home-after-phone.png']],
  ['support-observation.json', 'appAccessConsent', 'yes'],
  ['support-observation.json', 'emailDeliveryVerified', true]])
  test(`blocked dialer evidence rejects unsupported ${key}`, () => {
    assert.throws(() => validateEmergencyDialerPreflight(process.cwd(), preflight, path => {
      const bytes = readFileSync(path); if (!path.endsWith('/' + file)) return bytes;
      const changed = JSON.parse(bytes); changed[key] = value; return Buffer.from(JSON.stringify(changed));
    }));
  });

const retained = 'docs/release/evidence/emergency-phone-2026-10-21/results.json';
test('actual retained phone evidence remains partial with separately bounded recovery checks', () => {
  const run = validateEmergencyPhoneArtifacts(process.cwd(), retained);
  assert.equal(run.completed, false); assert.equal(run.captures.length, 8);
});
test('retained validation rejects promotion and altered checkpoint bytes', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-emergency-retained-test-'));
  try {
    const base = resolve(root, 'docs/release/evidence/emergency-phone-2026-10-21');
    cpSync(resolve(process.cwd(), 'docs/release/evidence/emergency-phone-2026-10-21'), base, { recursive: true });
    const original = readFileSync(resolve(root, retained), 'utf8');
    writeFileSync(resolve(root, retained), original.replace('"completed": false', '"completed": true'));
    assert.throws(() => validateEmergencyPhoneArtifacts(root, retained));
    writeFileSync(resolve(root, retained), original);
    const checkpoint = resolve(base, 'checkpoints/contact-empty.json');
    writeFileSync(checkpoint, readFileSync(checkpoint, 'utf8') + ' ');
    assert.throws(() => validateEmergencyPhoneArtifacts(root, retained), /contact-empty/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// Fictional unit fixtures only. Actual phone results are retained separately.
function fixture() {
  return { projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32),
    identity: { childId: 'child', childInstanceId: 'instance', contactIds: ['adult', 'child-contact'] },
    state: { contacts: [
      { id: 'adult', kind: 'self', subjectId: 'sgm-qa-parent', revision: 1,
        contact: { name: 'Contact adulte QA', phone: '+12025550123' }, lastActorUserId: 'sgm-qa-parent' },
      { id: 'child-contact', kind: 'child', subjectId: 'child', childInstanceId: 'instance', revision: 1,
        contact: { name: 'Contact enfant QA', phone: '+12025550124' }, lastActorUserId: 'sgm-qa-parent' }],
    operations: [{ id: 'one', contactId: 'adult', revision: 1, actorUserId: 'sgm-qa-parent' },
      { id: 'two', contactId: 'child-contact', revision: 1, actorUserId: 'sgm-qa-parent' }],
    guardian: { status: 'revoked', revision: 3, lastActorUserId: 'sgm-qa-club-manager' } } };
}
test('cancelled removal requires an identical observed state and the same fixture identity', () => {
  const f = fixture(), before = verifyPhoneContactRecovery({ ...f, phase: 'before-removal' });
  const result = verifyPhoneContactRecovery({ ...f, before, phase: 'cancelled-removal' });
  assert.equal(result.unchangedSinceBeforeRemoval, true);
  assert.equal(result.primarySequenceCompleted, false); assert.equal(result.dialerHandoffProven, false);
  const changed = structuredClone(f); changed.state.operations[0].id = 'replacement-operation';
  assert.throws(() => verifyPhoneContactRecovery({ ...changed, before, phase: 'cancelled-removal' }), /unchanged/);
  assert.throws(() => verifyPhoneContactRecovery({ ...f, before: { ...before, runId: 'b'.repeat(32) }, phase: 'cancelled-removal' }));
});
test('removal and another account are verified without accepting the blocked dialer step', () => {
  const f = fixture(); f.state.contacts[0].revision = 2; f.state.contacts[0].contact = null;
  f.state.operations.push({ id: 'three', contactId: 'adult', revision: 2, actorUserId: 'sgm-qa-parent' });
  const result = verifyPhoneContactRecovery({ ...f, phase: 'other-account-empty',
    otherView: { kind: 'self', subjectId: 'sgm-qa-driver', revision: 0, contact: null } });
  assert.equal(result.operationCount, 3); assert.equal(result.otherAccountRevision, 0);
  for (const flag of ['primarySequenceCompleted', 'dialerHandoffProven', 'storeReviewAccepted', 'releaseTrackingAccepted'])
    assert.equal(result[flag], false);
  assert.throws(() => verifyPhoneContactRecovery({ ...f, phase: 'other-account-empty',
    otherView: { kind: 'self', subjectId: 'sgm-qa-parent', revision: 0, contact: null } }));
  assert.throws(() => verifyPhoneContactRecovery({ ...f, phase: 'adult-dialer-return' }));
  assert.throws(() => verifyPhoneContactRecovery({ ...f, projectId: 'production', phase: 'adult-removed' }));
});
test('independent observer does not change the primary sequence or write provider data', () => {
  const cli = readFileSync(new URL('../scripts/qa/read-emergency-phone-recovery.mjs', import.meta.url), 'utf8');
  assert.match(cli, /call\('getEmergencyContact'/);
  assert.doesNotMatch(cli, /call\('(?:save|transition|delete)|\.set\(|\.create\(|\.delete\(/);
  const primary = readFileSync(new URL('../scripts/qa/manual-emergency-session.mjs', import.meta.url), 'utf8');
  assert.match(primary, /Checkpoints must execute once in order/);
  assert.match(primary, /assert.equal\(checkpoints.length, emergencyPhonePhases.length\)/);
});
