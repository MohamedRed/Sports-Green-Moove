import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deleteApp, getApp } from 'firebase-admin/app';
import { auth, call, db, denied, document, signIn } from './local-flow-client.mjs';
import { openPostCommitLossProxy, postJsonWithoutRetry } from './post-commit-loss-proxy.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const parent = await signIn('p@example.test'), other = await signIn('d@example.test');
await auth.createUser({ uid: 'sgm-support-admin', email: 'support-admin@example.test', password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims('sgm-support-admin', { roleKeys: ['admin'] });
const admin = await signIn('support-admin@example.test'), actors = [parent, other, admin];
const claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
const baseline = new Map();
for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
const input = (actor = parent, extra = {}) => ({ clientRequestId: randomUUID(), requesterUserId: actor.uid,
  subjectType: 'other', reason: 'Support reprise QA', description: 'Demande fictive conservee pendant une coupure.', emergency: false, ...extra });
const checks = [], lostAcknowledgement = [];
let success = false;
async function check(id, action) { await action(); checks.push({ id, status: 'passed' }); console.log(id + ': passed'); }
try {
  await check('identity-is-required-and-input-is-bounded-before-write', async () => {
    for (const extra of [{ clientRequestId: undefined }, { clientRequestId: 'bad' }, { description: '' },
      { reason: 'x'.repeat(121) }, { emergency: 'yes' }, { reporterUserId: other.uid }])
      await denied('submitSupportReport', parent, input(parent, extra), 'INVALID_ARGUMENT');
    await denied('submitSupportReport', null, input(), 'UNAUTHENTICATED');
    assert.equal((await db.collection('supportSubmissionOperations').get()).size, 0);
  });
  const request = input(), first = await call('submitSupportReport', parent, request);
  await check('original-acknowledgement-binds-request-and-account', async () => {
    assert.equal(first.clientRequestId, request.clientRequestId); assert.equal(first.requesterUserId, parent.uid);
    assert.equal(first.status, 'open'); assert.equal(first.reused, false); assert.match(first.reportId, /^[a-f0-9]{64}$/);
    const report = await document('reports', first.reportId);
    assert.equal(report.reporterUserId, parent.uid); assert.equal(report.description, request.description);
    assert.deepEqual(report.createdAt, report.updatedAt); assert.equal(report.publicReplyCount, 0);
  });
  await check('concurrent-identical-retries-create-one-report', async () => {
    const action = input(); const receipts = await Promise.all(Array.from({ length: 3 }, () => call('submitSupportReport', parent, action)));
    assert.equal(new Set(receipts.map(row => row.reportId)).size, 1); assert.equal(receipts.filter(row => !row.reused).length, 1);
    const reports = await db.collection('reports').where('reporterUserId', '==', parent.uid).get(); assert.equal(reports.size, 2);
  });
  await check('changed-reuse-never-overwrites-any-submission-field', async () => {
    const before = await document('reports', first.reportId);
    for (const extra of [{ reason: 'Changed' }, { description: 'Changed request' }, { emergency: true }, { subjectType: 'user' }, { subjectId: 'changed' }])
      await denied('submitSupportReport', parent, { ...request, ...extra }, 'ALREADY_EXISTS');
    assert.deepEqual(await document('reports', first.reportId), before);
  });
  await check('retry-after-review-preserves-status-private-notes-and-timestamps', async () => {
    await call('reviewReport', admin, { reportId: first.reportId, status: 'closed', note: 'PRIVATE-SUBMISSION-REVIEW' });
    const before = await document('reports', first.reportId), receipt = await call('submitSupportReport', parent, request);
    assert.equal(receipt.reused, true); assert.equal(receipt.reportId, first.reportId);
    assert.deepEqual(await document('reports', first.reportId), before);
    const view = await call('getMySupportReport', parent, { reportId: first.reportId }); assert.equal(view.report.status, 'closed');
    assert.doesNotMatch(JSON.stringify(view), /PRIVATE|digest|clientRequestId|requesterUserId/);
  });
  await check('same-identity-is-account-scoped-and-foreign-account-input-is-denied', async () => {
    await denied('submitSupportReport', other, request, 'PERMISSION_DENIED');
    const receipt = await call('submitSupportReport', other, { ...request, requesterUserId: other.uid });
    assert.notEqual(receipt.reportId, first.reportId);
    await denied('getMySupportReport', parent, { reportId: receipt.reportId }, 'NOT_FOUND');
    await denied('getMySupportReport', other, { reportId: first.reportId }, 'NOT_FOUND');
  });
  await check('urgent-flag-survives-create-read-and-retry-without-claiming-a-call', async () => {
    const action = input(parent, { emergency: true }), receipt = await call('submitSupportReport', parent, action);
    assert.equal((await document('reports', receipt.reportId)).emergency, true);
    assert.equal((await call('getMySupportReport', parent, { reportId: receipt.reportId })).report.emergency, true);
    assert.equal((await call('submitSupportReport', parent, action)).reportId, receipt.reportId);
  });
  await check('post-commit-disconnect-then-explicit-retry-retains-one-report', async () => {
    const action = input(), before = (await db.collection('reports').get()).size;
    const proxy = await openPostCommitLossProxy(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/submitSupportReport`, async reportId => {
      const saved = await document('reports', reportId), operation = await document('supportSubmissionOperations', reportId);
      assert.equal(saved.reporterUserId, parent.uid); assert.equal(saved.description, action.description);
      assert.equal(operation.clientRequestId, action.clientRequestId); return { reportId, matchingOperation: true };
    });
    try {
      await assert.rejects(() => postJsonWithoutRetry(proxy.url, parent.token, action), error => error.code === 'ECONNRESET' && !error.responseReceived);
      assert.equal(proxy.attempts.length, 1); assert.equal((await db.collection('reports').get()).size, before + 1);
      const receipt = await postJsonWithoutRetry(proxy.url, parent.token, action);
      assert.equal(receipt.status, 200); assert.equal(receipt.json.result.reused, true);
      assert.equal(receipt.json.result.reportId, proxy.attempts[0].commit.reportId); assert.equal(proxy.attempts.length, 2);
      assert.equal((await db.collection('reports').get()).size, before + 1); lostAcknowledgement.push(...proxy.attempts);
    } finally { await proxy.close(); }
  });
  await check('submission-operation-and-raw-report-reads-stay-private', async () => {
    for (const path of [`reports/${first.reportId}`, `supportSubmissionOperations/${first.reportId}`]) {
      const result = await fetch(`http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/${path}`,
        { headers: { authorization: `Bearer ${parent.token}` } }); assert.equal(result.status, 403);
    }
  });
  await check('missing-committed-record-is-refused-without-recreation', async () => {
    const action = input(), receipt = await call('submitSupportReport', parent, action), ref = db.collection('reports').doc(receipt.reportId);
    const saved = (await ref.get()).data(); await ref.delete();
    await denied('submitSupportReport', parent, action, 'FAILED_PRECONDITION'); assert.equal((await ref.get()).exists, false);
    await ref.create(saved);
  });
  await check('new-explicit-identity-can-create-a-new-request-after-confirmation', async () => {
    const second = await call('submitSupportReport', parent, { ...request, clientRequestId: randomUUID() });
    assert.notEqual(second.reportId, first.reportId); assert.equal(second.reused, false);
  });
  await check('protected-fixtures-and-account-claims-stay-unchanged', async () => {
    for (const [path, value] of baseline) assert.deepEqual((await db.doc(path).get()).data(), value, path);
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
  });
  success = true;
} finally {
  await deleteApp(getApp()); const output = process.env.SGM_LOCAL_FLOW_OUTPUT; assert(output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(),
    scope: 'local-emulated-support-submission-services-not-phone-ui', completed: success, checks, lostAcknowledgement,
    protectedRecordCount: baseline.size, adminClientClosed: true, nativeUi: false, physicalDevice: false,
    emergencyCallVerified: false, urgentEscalationVerified: false, productionWrites: false }, null, 2) + '\n');
}
