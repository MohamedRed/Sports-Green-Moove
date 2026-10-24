import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateUrgentSupportEvidence } from '../scripts/qa/support-urgent-evidence.mjs';
import { validateFocusedPreparationEvidence } from '../scripts/qa/native-focused-preparation-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
test('both submission contracts atomically queue support-only urgent mail without replacing the installed endpoint', () => {
  for (const path of ['functions/src/services/supportSubmission.ts', 'functions/src/callables/feedback.ts']) {
    const code = read(path); assert(code.includes('queueUrgentSupportEmail(transaction,')); assert(code.includes('firestore.runTransaction'));
  }
  const queue = read('functions/src/services/supportUrgentQueue.ts');
  assert(queue.includes('if (!emergency) return')); assert(queue.includes('transaction.create(')); assert(queue.includes('audience: "support"'));
  assert.doesNotMatch(queue, /clubManager|notifications|email:/);
});
test('mail operation is server-write-only and its callable requires administrator authority', () => {
  assert.match(read('firestore.rules'), /match \/supportUrgentEmailOutbox\/\{reportId\} \{\s*allow read: if isAdmin\(\);\s*allow write: if false;/);
  assert(read('functions/src/supportUrgentEmail.ts').includes('requireAdmin(request.auth?.token)'));
  assert(read('functions/src/supportUrgentEmail.ts').includes('retry: true'));
});
test('urgent discovery bypasses the ordinary window and direct closed links read the exact document', () => {
  const query = read('admin/src/useUrgentSupport.ts'); assert(query.includes('where("emergency", "==", true)'));
  assert(query.includes('where("status", "in", ["open", "reviewing"])')); assert.doesNotMatch(query, /limit\(/);
  assert(read('admin/src/SupportReportLink.tsx').includes('doc(firestore, "reports", id)'));
  assert(read('admin/src/SupportEmailStatus.tsx').includes('E-mail accepté pour envoi'));
  assert.doesNotMatch(read('admin/src/SupportEmailStatus.tsx'), /E-mail livré|E-mail reçu/);
  assert(!read('admin/src/ClubDashboard.tsx').includes('UrgentSupportPanel'));
});
test('review omits an absent note rather than serializing undefined as null through the callable SDK', () => {
  const actions = read('admin/src/actions.ts');
  assert(actions.includes('...(trimmedNote.length > 0 ? { note: trimmedNote } : {})'));
  assert.doesNotMatch(actions, /note: trimmedNote.length > 0 \? trimmedNote : undefined/);
});
test('smoke runs the real isolated service suite and disables actual email credentials', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.match(/"tests\/support-urgent-contract.test.mjs"/g)?.length, 2);
  assert(workflow.includes('npm run test:support-urgent && node --test tests/support-urgent-contract.test.mjs'));
  const runtime = read('scripts/qa/local-runtime.mjs');
  for (const key of ['SUPPORT_EMAIL_API_KEY', 'SUPPORT_EMAIL_CONFIG']) assert(runtime.includes(key));
  assert(runtime.includes('LOCAL_PROVIDER_DISABLED'));
});
const urgent = 'docs/release/evidence/support-urgent-2026-10-23/';
const native = 'docs/release/evidence/native-terminal-fb628d5b-2026-10-23/';
test('retained local urgent and terminal native observations stay independently scoped and checksum-bound', () => {
  validateUrgentSupportEvidence(root, urgent + 'services.json');
  validateFocusedPreparationEvidence(root, { source: native + 'summary.json', checkedAt: '2026-10-23', checksums: native + 'artifact-sha256.json' });
});
for (const [name, file, change] of [
  ['real email receipt', 'services.json', row => row.realEmailSent = true],
  ['physical device', 'browser.json', row => row.physicalDevice = true],
  ['duplicate scenario', 'services.json', row => row.checks[1] = row.checks[0]],
  ['hidden urgent row', 'browser.json', row => row.viewportChecks[0].urgentRows = 0],
  ['missing baseline check', 'saved-state.json', row => row.allBaselineRecordsUnchanged = false],
  ['unremoved credential', 'cleanup.json', row => row.fixtureCredentialFileRemoved = false],
]) test('rejects rehashed urgent evidence promoted to ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-urgent-evidence-test-'));
  try {
    cpSync(resolve(root, urgent), temp, { recursive: true });
    const value = JSON.parse(readFileSync(resolve(temp, file))); change(value);
    writeFileSync(resolve(temp, file), JSON.stringify(value));
    const hashes = JSON.parse(readFileSync(resolve(temp, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(readFileSync(resolve(temp, file))).digest('hex');
    writeFileSync(resolve(temp, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateUrgentSupportEvidence(temp, 'services.json'));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
