import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateSupportProcessRestartPhone, validateSupportProcessRestartScope } from '../scripts/qa/support-process-restart-phone-evidence.mjs';

test('the physical held-response restart/retry preserves exact records without accepting network loss, SDK counting or uninstall', () => {
  const report = validateSupportProcessRestartPhone(process.cwd(), 'docs/release/evidence/support-process-restart-phone-2026-10-22/summary.json');
  for (const field of ['realNetworkLossVerified', 'sdkCallsMeasured', 'earlierReplayRootCauseEstablished', 'appUninstallVerified',
    'fullControllerCompleted', 'fullCiPassed', 'allBaselineVerifiedAfterCommit', 'secondPostConfirmationProcessRestartVerified', 'releaseComplete'])
    assert.throws(() => validateSupportProcessRestartScope({ ...report, [field]: true }));
});
test('the independent observer only reads records and refuses missing or invalid scope before connecting', () => {
  const file = 'scripts/qa/observe-support-recovery-records.mjs', source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /submitSupportReport|\.set\(|\.update\(|\.delete\(|customClaims|spawn|execFile/);
  assert.match(source, /verifySupportRecoveryCheckpoint\(phase, state, fixture\)/);
  assert.match(source, /physicalUiVerifiedByScript: false/); assert.match(source, /flowAccepted: false/);
  const invalid = spawnSync(process.execPath, [file], { encoding: 'utf8' }); assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /AssertionError/); assert.doesNotMatch(invalid.stderr, /ECONNREFUSED|FirebaseError/);
});
