import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateSupportSubmissionEvidence } from '../scripts/qa/support-submission-evidence.mjs';
const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
test('support submission requires a durable account-bound identity without changing the installed-client endpoint', () => {
  const callable = read('functions/src/callables/supportSubmission.ts'), schema = read('functions/src/domain/supportSubmission.ts');
  const service = read('functions/src/services/supportSubmission.ts');
  assert(callable.includes('submit(uid, parseCallableData(supportSubmissionSchema, request.data))'));
  assert(read('functions/src/callables/feedback.ts').includes('export const createReport = onCall'));
  assert(schema.includes('clientRequestId: z.uuid()')); assert(schema.includes('requesterUserId:')); assert(schema.includes('}).strict()'));
  assert(service.includes('input.requesterUserId !== uid')); assert(service.includes('firestore.runTransaction'));
  assert(service.includes('transaction.create(reportRef')); assert(service.includes('transaction.create(operationRef'));
  assert.doesNotMatch(service, /transaction\.(set|update)\(/);
});
test('native callers freeze persisted content, validate receipt identity and enforce current account', () => {
  const android = read('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGateway.kt');
  const swift = read('ios/Sources/SportsGreenMooveApp/FirebaseFeedbackGateway.swift');
  assert(android.includes('getHttpsCallable("submitSupportReport")')); assert(swift.includes('httpsCallable("submitSupportReport")'));
  for (const code of [android, swift]) assert.doesNotMatch(code, /(?:getHttpsCallable|httpsCallable)\("createReport"\)/);
  for (const code of [android, swift]) {
    assert(code.includes('currentUser?.uid')); assert(code.includes('submission.uid'));
    assert(code.includes('submission.payload')); assert(code.includes('submission.acknowledgedReport'));
  }
  for (const file of ['android/app/src/main/java/be/sportgreenmoove/app/ui/SupportSubmissionState.kt',
    'ios/Sources/SportsGreenMooveApp/SupportSubmissionState.swift']) {
    const code = read(file); assert(code.includes('store.begin(')); assert(code.includes('store.acknowledge('));
    assert(code.includes('pending')); assert(code.includes('closed')); assert(code.includes('checkCancellation') || code.includes('ensureActive'));
  }
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/ui/OptionsReportCard.kt').includes('context.noBackupFilesDir'));
  assert(read('ios/Sources/SportsGreenMooveApp/SupportSubmission.swift').includes('isExcludedFromBackup = true'));
});
test('fault injection permits only the explicit local submission endpoint and verifies commit before dropping confirmation', () => {
  const proxy = read('scripts/qa/post-commit-loss-proxy.mjs'), suite = read('scripts/qa/local-support-submission-suite.mjs');
  assert(proxy.includes('[`${origin}submitSupportReport`, \'reportId\']'));
  assert(suite.includes("document('supportSubmissionOperations', reportId)"));
  assert(suite.includes("error.code === 'ECONNRESET' && !error.responseReceived"));
  assert(suite.includes("assert.equal(proxy.attempts.length, 1)"));
  assert(suite.includes('local-emulated-support-submission-services-not-phone-ui'));
});
test('smoke covers the new service suite and native tests remain wired', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.match(/"tests\/support-submission.test.mjs"/g)?.length, 2);
  assert(workflow.includes('npm run test:support-submission && node --test tests/support-submission.test.mjs'));
  const swift = read('scripts/check-ios-native-plan.sh'); assert(swift.includes('SupportSubmissionChecks.swift'));
  assert(read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/SupportSubmissionFlowTest.kt').includes('local-ui-evidence'));
});
const relative = 'docs/release/evidence/support-submission-recovery-2026-10-22/summary.json';
test('retained real local service and simulated component evidence stays checksum-bound and scoped', () => {
  validateSupportSubmissionEvidence(root, relative);
});
for (const [name, file, change] of [
  ['physical phone', 'summary.json', row => row.physicalDevice = true],
  ['connected network flow', 'summary.json', row => row.fullAppNetworkRecoveryVerified = true],
  ['process restart', 'summary.json', row => row.appProcessRestartVerified = true],
  ['urgent escalation', 'summary.json', row => row.urgentEscalationVerified = true],
  ['production deployment', 'summary.json', row => row.productionDeployed = true],
  ['accelerated recording', 'summary.json', row => row.clip.speed = 2],
  ['unverified frame mapping', 'summary.json', row => row.images[0] = row.images[2]],
  ['missing after-commit verification', 'services.json', row => row.lostAcknowledgement[0].commit.matchingOperation = false],
  ['missing protected fixtures', 'services.json', row => row.protectedRecordCount = 0],
  ['failed cleanup', 'cleanup.json', row => row.ownedAvdRemoved = false],
]) test('rejects rehashed ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-support-submission-proof-'));
  try {
    cpSync(resolve(root, relative, '..'), temp, { recursive: true }); const path = resolve(temp, file), value = JSON.parse(readFileSync(path));
    change(value); writeFileSync(path, JSON.stringify(value));
    const manifest = resolve(temp, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(manifest));
    hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(manifest, JSON.stringify(hashes));
    assert.throws(() => validateSupportSubmissionEvidence(temp, 'summary.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
