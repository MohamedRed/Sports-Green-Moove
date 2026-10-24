import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyEmergencyPhoneCheckpoint } from './manual-emergency-checkpoints.mjs';

export const recoveryPhases = ['before-removal', 'cancelled-removal', 'adult-removed', 'other-account-empty'];
const scope = 'independent-phone-contact-recovery-not-dialer-or-complete-primary-sequence';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export function verifyPhoneContactRecovery({ phase, state, identity, projectId, runId, before, otherView }) {
  assert(recoveryPhases.includes(phase)); assert.equal(projectId, 'demo-sgm-local-qa');
  assert.match(runId, /^[a-f0-9]{32}$/); assert(identity.childInstanceId);
  const expectedPhase = ['before-removal', 'cancelled-removal'].includes(phase) ? 'child-revoked' : phase;
  const checkpoint = verifyEmergencyPhoneCheckpoint(expectedPhase, state, identity);
  const stateDigest = createHash('sha256').update(JSON.stringify(canonical(JSON.parse(JSON.stringify(state))))).digest('hex');
  if (phase === 'cancelled-removal') {
    assert.equal(before?.scope, scope); assert.equal(before.phase, 'before-removal');
    assert.equal(before.runId, runId); assert.equal(before.childInstanceId, identity.childInstanceId);
    assert.equal(before.stateDigest, stateDigest, 'Cancelling removal must leave the complete observed contact state unchanged');
  }
  if (phase === 'other-account-empty') {
    assert.equal(otherView?.kind, 'self'); assert.equal(otherView.subjectId, 'sgm-qa-driver');
    assert.equal(otherView.revision, 0); assert.equal(otherView.contact, null);
  }
  return { projectId, runId, scope, phase, recordedAt: new Date().toISOString(),
    childInstanceId: identity.childInstanceId, stateDigest,
    adultRevision: checkpoint.adultRevision, childRevision: checkpoint.childRevision,
    operationCount: checkpoint.operationCount, guardianStatus: checkpoint.guardianStatus,
    primarySequenceCompleted: false, dialerHandoffProven: false, storeReviewAccepted: false,
    releaseTrackingAccepted: false, ...(phase === 'cancelled-removal' ? { unchangedSinceBeforeRemoval: true } : {}),
    ...(phase === 'other-account-empty' ? { otherAccountSubjectId: otherView.subjectId, otherAccountRevision: 0 } : {}) };
}
