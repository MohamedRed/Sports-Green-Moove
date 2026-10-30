import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateSupportRecoveryPhoneEvidence, validateSupportRecoveryPhoneScope } from '../scripts/qa/support-recovery-phone-evidence.mjs';
import {assertSupportRecheckScope, supportRecheckFolder, validateSupportRecheck, validateSupportRecheckCi} from '../scripts/qa/support-recovery-recheck-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
const source = 'docs/release/evidence/support-recovery-phone-attempt-2026-10-22/summary.json';
test('later phone retry retains all eight original checkpoints, independent process probes and disposal', () => {
  const report = validateSupportRecheck(process.cwd()), flow = content.flows.find(row => row.id === 'support-submission');
  assert.equal(flow.checkedAt, report.checkedAt); assert.equal(flow.status, 'partial');
  assert.equal(flow.images[0].file, 'support-recheck-history'); assert.equal(flow.images.length, 19);
  assert.equal(flow.submissionRecoveryRecheck.source, supportRecheckFolder + 'summary.json');
  assert.deepEqual(validateSupportRecheckCi(process.cwd()), {ordinaryPassed: 205, focusedJobs: 11, observedReplayTranscripts: 17, fullGatePassed: false});
  assert.equal(content.blockers.find(row => row.id === 'native-evidence-copy').latestSource,
    'docs/release/evidence/native-timeout-9abc639-2026-10-30/README.md');
  assert(content.updates.some(row => row.source === supportRecheckFolder + 'README.md'));
});
for (const key of ['physicalRadioLossVerified', 'trackingNetworkLossVerified', 'urgentEscalationVerified', 'realEmailSent',
  'earlierReplayRootCauseEstablished', 'handlerClosedBeforeReleaseVerified', 'installedBytesIndependentlyHashed',
  'fullCiPassed', 'releaseComplete', 'productionWrites', 'videoRecorded', 'iosPhysicalUiVerified'])
  test('new controlled phone trial cannot accept ' + key, () => {
    const report = JSON.parse(readFileSync(supportRecheckFolder + 'summary.json')); report[key] = true;
    assert.throws(() => assertSupportRecheckScope(report));
  });
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
