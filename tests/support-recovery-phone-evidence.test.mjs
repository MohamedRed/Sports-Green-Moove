import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateSupportRecoveryPhoneEvidence, validateSupportRecoveryPhoneScope } from '../scripts/qa/support-recovery-phone-evidence.mjs';
const source = 'docs/release/evidence/support-recovery-phone-attempt-2026-10-22/summary.json';
test('retained physical attempt preserves its rejected interpretation and unclassified replay', () => {
  const report = validateSupportRecoveryPhoneEvidence(process.cwd(), source);
  assert.equal(Object.keys(report.publishedCaptures).length, 4);
});
for (const field of ['completed', 'flowAccepted', 'explicitRetryVerified', 'pendingProcessRestartVerified',
  'replayOriginEstablished', 'urgentEscalationVerified', 'trackingNetworkLossVerified', 'videoRecorded'])
  test('cannot promote incomplete physical evidence: ' + field, () => {
    const report = JSON.parse(readFileSync(source)); report[field] = true;
    assert.throws(() => validateSupportRecoveryPhoneScope(report));
  });
