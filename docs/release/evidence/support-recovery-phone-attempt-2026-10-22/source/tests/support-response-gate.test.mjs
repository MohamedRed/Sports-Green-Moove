import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { holdSupportSubmissionResponse, supportResponseGateInput } from '../scripts/qa/support-submission-response-gate.mjs';
import { installSupportResponseGate } from '../scripts/qa/install-support-response-gate.mjs';
const root = resolve(import.meta.dirname, '..');
function fixture() {
  const output = mkdtempSync(resolve(tmpdir(), 'sgm-support-gate-test-'));
  const config = { projectId: 'demo-sgm-local-qa', runId: 'a'.repeat(32), output, maxHoldMs: 1000 };
  const receipt = { reportId: 'b'.repeat(64), clientRequestId: 'f18da3ad-f4ad-4797-83c1-60ddf07b9228', requesterUserId: supportResponseGateInput.uid, reused: false };
  const response = new EventEmitter();
  const request = { auth: { uid: supportResponseGateInput.uid }, data: { ...supportResponseGateInput,
    subjectType: 'other', clientRequestId: receipt.clientRequestId }, rawRequest: { res: response } };
  let verifications = 0;
  const verifyCommitted = async () => { verifications++; return { reportId: receipt.reportId, operationId: receipt.reportId,
    digest: 'c'.repeat(64), originalContentVerified: true }; };
  return { config, receipt, request, response, verifyCommitted, verifications: () => verifications,
    cleanup: () => rmSync(output, { recursive: true, force: true }) };
}
async function waitForFile(path) {
  const end = Date.now() + 1000; while (!existsSync(path)) { assert(Date.now() < end); await delay(5); }
}
function release(f) { writeFileSync(resolve(f.config.output, 'release.json'), JSON.stringify({ runId: f.config.runId, reportId: f.receipt.reportId }), { flag: 'wx' }); }
test('only the exact synthetic parent action can be held', async () => {
  const f = fixture();
  try {
    for (const request of [{ ...f.request, auth: { uid: 'other' } }, { ...f.request, data: { ...f.request.data, reason: 'Other' } }])
      assert.equal(await holdSupportSubmissionResponse({ ...f, request }), f.receipt);
    assert.equal(f.verifications(), 0); assert.deepEqual(readdirSync(f.config.output), []);
  } finally { f.cleanup(); }
});
test('independent commit is verified before hold, release preserves the actual receipt and close scope stays explicit', async () => {
  const f = fixture(); let resolved = false;
  try {
    const result = holdSupportSubmissionResponse(f).then(value => { resolved = true; return value; });
    await waitForFile(resolve(f.config.output, 'held.json')); assert.equal(f.verifications(), 1); assert.equal(resolved, false);
    f.response.emit('close'); release(f); assert.equal(await result, f.receipt);
    const closed = JSON.parse(readFileSync(resolve(f.config.output, 'handler-response-closed.json')));
    assert.equal(closed.scope, 'handler-transport-observation-not-device-network-proof');
    const released = JSON.parse(readFileSync(resolve(f.config.output, 'released.json')));
    assert(released.handlerClosedBeforeReleaseAt); assert.equal(released.receiptUnchanged, true); assert.equal(f.response.listenerCount('close'), 0);
  } finally { f.cleanup(); }
});
test('a repeated real response is recorded but never held a second time', async () => {
  const f = fixture(); let original;
  try {
    original = holdSupportSubmissionResponse(f); await waitForFile(resolve(f.config.output, 'held.json'));
    const receipt = { ...f.receipt, reused: true };
    assert.equal(await holdSupportSubmissionResponse({ ...f, receipt }), receipt);
    assert.equal(readdirSync(f.config.output).filter(file => file.startsWith('attempt-')).length, 2);
    release(f); await original;
  } finally { if (original) await original.catch(() => {}); f.cleanup(); }
});
test('expiry is a failed experiment, not a fabricated acknowledgement', async () => {
  const f = fixture(); f.config.maxHoldMs = 20;
  try {
    await assert.rejects(holdSupportSubmissionResponse(f), /expired/);
    assert(existsSync(resolve(f.config.output, 'expired.json'))); assert(!existsSync(resolve(f.config.output, 'released.json')));
    assert.equal(f.response.listenerCount('close'), 0);
  } finally { f.cleanup(); }
});
test('missing independent commit evidence and non-isolated configuration fail before holding', async () => {
  const f = fixture();
  try {
    await assert.rejects(holdSupportSubmissionResponse({ ...f, verifyCommitted: async () => ({ reportId: f.receipt.reportId }) }));
    await assert.rejects(holdSupportSubmissionResponse({ ...f, config: { ...f.config, projectId: 'sports-green-moove-prod' } }));
    assert.deepEqual(readdirSync(f.config.output), []);
  } finally { f.cleanup(); }
});
test('the copied runtime export delegates to the production handler without altering production source or the tunnel allowlist', () => {
  const before = readFileSync(resolve(root, 'functions/src/callables/supportSubmission.ts'), 'utf8');
  const installer = readFileSync(resolve(root, 'scripts/qa/install-support-response-gate.mjs'), 'utf8');
  assert(installer.includes('const receipt = await original.run(request)'));
  assert(installer.includes("assert.equal(process.env.FUNCTIONS_EMULATOR, 'true')"));
  assert(installer.includes('Instrument exactly the selected copied callable export'));
  assert.throws(() => installSupportResponseGate({ env: { GCLOUD_PROJECT: 'production' } }, '/tmp/never-created-support-gate'));
  assert.equal(readFileSync(resolve(root, 'functions/src/callables/supportSubmission.ts'), 'utf8'), before);
});
