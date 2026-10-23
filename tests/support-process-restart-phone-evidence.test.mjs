import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateSupportProcessRestartPhone, validateSupportProcessRestartScope } from '../scripts/qa/support-process-restart-phone-evidence.mjs';
import { validateConfirmedSupportPhone, validateConfirmedSupportScope } from '../scripts/qa/support-confirmed-restart-phone-evidence.mjs';
import { validateNativeTransferRecheck } from '../scripts/qa/native-transfer-recheck-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

test('the physical held-response restart/retry preserves exact records without accepting network loss, SDK counting or uninstall', () => {
  const report = validateSupportProcessRestartPhone(process.cwd(), 'docs/release/evidence/support-process-restart-phone-2026-10-22/summary.json');
  for (const field of ['realNetworkLossVerified', 'sdkCallsMeasured', 'earlierReplayRootCauseEstablished', 'appUninstallVerified',
    'fullControllerCompleted', 'fullCiPassed', 'allBaselineVerifiedAfterCommit', 'secondPostConfirmationProcessRestartVerified', 'releaseComplete'])
    assert.throws(() => validateSupportProcessRestartScope({ ...report, [field]: true }));
});
test('both native force-stop stages retain all ten independent checkpoints without upgrading unmeasured scope', () => {
  const flow = content.flows.find(item => item.id === 'support-submission');
  const report = validateConfirmedSupportPhone(process.cwd(), flow.submissionConfirmedRestartPhone.source);
  for (const key of ['processIdsMeasured', 'sdkCallsMeasured', 'realNetworkLossVerified', 'urgentEscalationVerified',
    'finalPhysicalHistoryReadVerified', 'appUninstallVerified', 'videoRecorded', 'releaseComplete'])
    assert.throws(() => validateConfirmedSupportScope({ ...report, [key]: true }));
  assert.equal(flow.checkedAt, '2026-10-23'); assert.equal(flow.submissionRestartPhone.checkedAt, '2026-10-22');
  assert(flow.images[0].file.startsWith('support-confirmed-phone-')); assert.equal(flow.status, 'partial');
});
test('the historical failed collection stays failed while the newer blocker follows its separate terminal result', () => {
  const record = content.nativeTransferRecheck, report = validateNativeTransferRecheck(process.cwd(), record);
  assert.equal(report.fullCiPassed, false); assert.equal(report.focusedCasesPassed, 10);
  assert.equal(content.blockers.find(item => item.id === 'test-device-stability').source,
    content.nativeNetworkPreparationRecheck.source.replace('run.json', 'README.md'));
  assert.notEqual(content.nativeNetworkPreparationRecheck.source, record.source);
});
test('the independent observer only reads records and refuses missing or invalid scope before connecting', () => {
  const file = 'scripts/qa/observe-support-recovery-records.mjs', source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /submitSupportReport|\.set\(|\.update\(|\.delete\(|customClaims|spawn|execFile/);
  assert.match(source, /verifySupportRecoveryCheckpoint\(phase, state, fixture\)/);
  assert.match(source, /physicalUiVerifiedByScript: false/); assert.match(source, /flowAccepted: false/);
  const invalid = spawnSync(process.execPath, [file], { encoding: 'utf8' }); assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /AssertionError/); assert.doesNotMatch(invalid.stderr, /ECONNREFUSED|FirebaseError/);
});
