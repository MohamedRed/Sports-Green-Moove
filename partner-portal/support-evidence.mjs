import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { validateSupportPhone } from '../scripts/qa/support-phone-evidence.mjs';
import { validateSupportFollowup } from '../scripts/qa/support-followup-evidence.mjs';
import { validateSupportFollowupPhone } from '../scripts/qa/support-followup-phone-evidence.mjs';
import { validateSupportSubmissionEvidence } from '../scripts/qa/support-submission-evidence.mjs';
import { validateSupportRecoveryPhoneEvidence } from '../scripts/qa/support-recovery-phone-evidence.mjs';
import { validateSupportDiagnosticEvidence } from '../scripts/qa/support-recovery-diagnostic-evidence.mjs';
import { validateSupportProcessRestartPhone } from '../scripts/qa/support-process-restart-phone-evidence.mjs';
import { validateConfirmedSupportPhone } from '../scripts/qa/support-confirmed-restart-phone-evidence.mjs';

export function validateSupportEvidence(root, flow, captures) {
  if (flow.submissionConfirmedRestartPhone) {
    const record = flow.submissionConfirmedRestartPhone, proof = validateConfirmedSupportPhone(root, record.source);
    assert.equal(flow.id, 'support-submission'); assert.equal(flow.status, 'partial');
    assert.equal(flow.checkedAt, proof.checkedAt); assert.equal(record.checkedAt, proof.checkedAt);
    assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
    for (const [id, file] of Object.entries(proof.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id)); assert.equal(captures[id], dirname(record.source) + '/' + file);
    }
    assert.match(flow.verified, /seconde fermeture/); assert.match(flow.remaining, /vraie coupure/);
  }
  if (flow.submissionRecovery) {
    const record = flow.submissionRecovery, proof = validateSupportSubmissionEvidence(root, record.source);
    assert.equal(flow.id, 'support-submission'); assert.equal(flow.status, 'partial');
    assert.equal(flow.latestEvidence, flow.submissionPhoneAttempt ? 'phone' : 'local');
    assert.equal(record.checkedAt, proof.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
    for (const file of proof.images) assert.equal(captures[file.split('/').at(-1).replace('.png', '')], dirname(record.source) + '/' + file);
    assert.match(flow.remaining, /téléphone réel/); assert.match(flow.remaining, /simulée/);
  }
  if (flow.submissionPhoneAttempt) {
    assert.equal(flow.id, 'support-submission'); assert.equal(flow.status, 'partial');
    const record = flow.submissionPhoneAttempt, proof = validateSupportRecoveryPhoneEvidence(root, record.source);
    assert.equal(record.checkedAt, proof.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
    for (const [id, file] of Object.entries(proof.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id)); assert.equal(captures[id], dirname(record.source) + '/' + file);
    }
    assert.match(flow.remaining, flow.submissionDiagnostics ? /renvois/ : /seconde tentative/);
    if (!flow.submissionRestartPhone) assert.match(flow.remaining, /fermeture/);
  }
  if (flow.submissionDiagnostics) {
    assert.equal(flow.id, 'support-submission'); assert.equal(flow.status, 'partial');
    const record = flow.submissionDiagnostics, proof = validateSupportDiagnosticEvidence(root, record.source);
    assert.equal(record.checkedAt, proof.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
    if (!flow.submissionRestartPhone) assert.match(flow.verified, /trois tentatives/);
    assert.match(flow.remaining, /renvois/);
  }
  if (flow.submissionRestartPhone) {
    assert.equal(flow.id, 'support-submission'); assert.equal(flow.status, 'partial');
    const record = flow.submissionRestartPhone, proof = validateSupportProcessRestartPhone(root, record.source);
    assert.equal(record.checkedAt, proof.checkedAt); assert.equal(record.checksums, dirname(record.source) + '/artifact-sha256.json');
    for (const [id, file] of Object.entries(proof.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id)); assert.equal(captures[id], dirname(record.source) + '/' + file);
    }
    assert.match(flow.verified, /arrêt complet/); assert.match(flow.remaining, /vraie coupure/);
  }
  if (flow.supportPhone) {
    assert.equal(flow.id, 'support'); assert.equal(flow.status, 'partial');
    const run = validateSupportPhone(root, flow.supportPhone.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportPhone.checkedAt);
    assert.equal(flow.supportPhone.checkedAt, flow.checkedAt);
    assert.equal(flow.supportPhone.checksums, dirname(flow.supportPhone.source) + '/artifact-sha256.json');
    for (const [id, file] of Object.entries(run.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id)); assert.equal(captures[id], dirname(flow.supportPhone.source) + '/' + file);
    }
  }
  if (flow.supportFollowup) {
    assert.equal(flow.id, 'support'); assert.equal(flow.status, 'partial');
    const run = validateSupportFollowup(root, flow.supportFollowup.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportFollowup.checkedAt);
    assert(flow.supportFollowupPhone, 'The latest phone follow-up remains independently scoped');
  }
  if (flow.supportFollowupPhone) {
    assert.equal(flow.status, 'partial');
    const run = validateSupportFollowupPhone(root, flow.supportFollowupPhone.source);
    assert.equal(run.testedAt.slice(0, 10), flow.supportFollowupPhone.checkedAt);
    for (const [id, file] of Object.entries(run.publishedCaptures)) {
      assert(flow.images.some(image => image.file === id));
      assert.equal(captures[id], dirname(flow.supportFollowupPhone.source) + '/' + file);
    }
    assert.match(flow.remaining, /erreurs de connexion/);
  }
}
