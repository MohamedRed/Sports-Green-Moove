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
await auth.createUser({ uid: 'sgm-support-admin', email: 'support-admin@example.test', password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims('sgm-support-admin', { roleKeys: ['admin'] });
await auth.createUser({ uid: 'sgm-support-outsider', email: 'support-outsider@example.test', password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims('sgm-support-outsider', { roleKeys: ['parent'] });
const parent = await signIn('p@example.test'), other = await signIn('support-outsider@example.test'), admin = await signIn('support-admin@example.test');
const checks = [], baseline = new Map();
for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
const claims = await Promise.all([parent, other, admin].map(async actor => (await auth.getUser(actor.uid)).customClaims));
const submit = async (actor = parent) => call('submitSupportReport', actor,
  { clientRequestId: randomUUID(), requesterUserId: actor.uid, subjectType: 'other', reason: 'Support QA', description: 'Demande isolee pour verifier la reponse.' });
const response = (reportId, extra = {}) => ({ reportId, requestId: randomUUID(), text: 'Votre demande est prise en charge.',
  expectedStatus: 'open', expectedReplyCount: 0, status: 'reviewing', ...extra });
const detail = reportId => call('getMySupportReport', parent, { reportId });
async function check(id, action) {
  await action(); checks.push({ id, status: 'passed' }); console.log(id + ': passed');
}
let success = false, browser = null;
try {
  const { reportId } = await submit(), foreign = await submit(other);
  await call('reviewReport', admin, { reportId, status: 'reviewing', note: 'INTERNAL-NOTE-MUST-NOT-BE-PUBLIC' });
  await check('owner-reads-only-public-status-and-own-content', async () => {
    const view = await detail(reportId); assert.equal(view.report.id, reportId); assert.equal(view.report.status, 'reviewing');
    assert.equal(view.report.replyCount, 0); assert.deepEqual(view.replies, { items: [], nextCursor: null });
    assert.doesNotMatch(JSON.stringify(view), /INTERNAL|reviewNote|reviewEvents|reviewedBy|authorUid|digest/);
    const listed = await call('listMySupportReports', parent); assert(listed.items.some(row => row.id === reportId));
    assert(!listed.items.some(row => row.id === foreign.reportId));
  });
  await check('anonymous-other-user-and-extra-owner-input-denied', async () => {
    await denied('getMySupportReport', null, { reportId }, 'UNAUTHENTICATED');
    await denied('getMySupportReport', other, { reportId }, 'NOT_FOUND');
    await denied('getMySupportReport', other, { reportId: 'absent-qa' }, 'NOT_FOUND');
    await denied('listMySupportReports', parent, { userId: other.uid }, 'INVALID_ARGUMENT');
    await denied('respondToReport', parent, response(reportId), 'PERMISSION_DENIED');
  });
  const input = response(reportId, { expectedStatus: 'reviewing', status: 'closed', text: 'Votre demande a ete traitee.' });
  let replyId;
  await check('admin-public-reply-closes-once-with-private-note-preserved', async () => {
    const first = await call('respondToReport', admin, input), again = await call('respondToReport', admin, input); replyId = first.replyId;
    assert.equal(first.reused, false); assert.equal(again.reused, true); assert.deepEqual(first.reply, again.reply);
    const view = await detail(reportId); assert.equal(view.report.status, 'closed'); assert.equal(view.report.replyCount, 1);
    assert.equal(view.replies.items.length, 1); assert.equal(view.replies.items[0].text, input.text);
    const stored = await document('reports', reportId); assert.equal(stored.reviewNote, 'INTERNAL-NOTE-MUST-NOT-BE-PUBLIC');
    assert.doesNotMatch(JSON.stringify(view), /INTERNAL|authorUid|digest|requestId|reviewNote/);
  });
  await check('changed-operation-and-stale-other-response-refused', async () => {
    await denied('respondToReport', admin, { ...input, text: 'Changed' }, 'ALREADY_EXISTS');
    await denied('respondToReport', admin, { ...input, requestId: randomUUID() }, 'FAILED_PRECONDITION');
    assert.equal((await detail(reportId)).report.replyCount, 1);
  });
  await check('duplicate-after-newer-status-does-not-roll-back', async () => {
    await call('reviewReport', admin, { reportId, status: 'reviewing', note: 'NEW-PRIVATE-NOTE' });
    assert.equal((await call('respondToReport', admin, input)).reused, true);
    assert.equal((await detail(reportId)).report.status, 'reviewing');
    assert.equal((await document('reports', reportId)).reviewNote, 'NEW-PRIVATE-NOTE');
  });
  await check('same-operation-race-creates-one-reply', async () => {
    const current = await submit(), request = response(current.reportId);
    const outcomes = await Promise.all([call('respondToReport', admin, request), call('respondToReport', admin, request)]);
    assert.equal(outcomes.filter(row => row.reused === false).length, 1);
    assert.equal(outcomes[0].replyId, outcomes[1].replyId); assert.equal((await detail(current.reportId)).report.replyCount, 1);
  });
  await check('different-response-race-requires-refresh', async () => {
    const current = await submit();
    const outcomes = await Promise.allSettled([call('respondToReport', admin, response(current.reportId)), call('respondToReport', admin, response(current.reportId))]);
    assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(outcomes.find(row => row.status === 'rejected').reason.code, 'FAILED_PRECONDITION');
    assert.equal((await detail(current.reportId)).report.replyCount, 1);
  });
  await check('lost-post-commit-response-retries-original-without-duplicate', async () => {
    const current = await submit(), request = response(current.reportId);
    const proxy = await openPostCommitLossProxy(`${process.env.FUNCTIONS_EMULATOR_ORIGIN}/respondToReport`, async id => {
      const view = await detail(current.reportId); assert.equal(view.report.replyCount, 1); assert.equal(view.report.lastReply.id, id);
      return { replyId: id, replyCount: 1 };
    });
    try {
      await assert.rejects(() => postJsonWithoutRetry(proxy.url, admin.token, request), error => error.code === 'ECONNRESET' && !error.responseReceived);
      assert.equal(proxy.attempts.length, 1);
      const retry = await postJsonWithoutRetry(proxy.url, admin.token, request);
      assert.equal(retry.status, 200); assert.equal(retry.json.result.reused, true);
      assert.equal(retry.json.result.replyId, proxy.attempts[0].commit.replyId);
      assert.equal((await detail(current.reportId)).report.replyCount, 1);
    } finally { await proxy.close(); }
  });
  await check('ticket-pagination-is-complete-and-owner-scoped', async () => {
    for (let index = 0; index < 22; index++) await submit();
    const first = await call('listMySupportReports', parent), second = await call('listMySupportReports', parent, { cursor: first.nextCursor });
    assert.equal(first.items.length, 20); assert(first.nextCursor); assert.equal(second.nextCursor, null);
    const ids = [...first.items, ...second.items].map(row => row.id); assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 26);
    await denied('listMySupportReports', other, { cursor: first.nextCursor }, 'PERMISSION_DENIED');
  });
  await check('reply-pagination-is-complete-and-report-scoped', async () => {
    let count = 1;
    for (; count < 23; count++) await call('respondToReport', admin, response(reportId,
      { expectedStatus: 'reviewing', expectedReplyCount: count, text: 'Reponse de suivi ' + count }));
    const first = await detail(reportId), second = await call('getMySupportReport', parent, { reportId, cursor: first.replies.nextCursor });
    assert.equal(first.replies.items.length, 20); assert.equal(second.replies.items.length, 3); assert.equal(second.replies.nextCursor, null);
    const rows = [...first.replies.items, ...second.replies.items]; assert.deepEqual(rows.map(row => row.sequence), Array.from({ length: 23 }, (_, index) => 23 - index));
    assert.equal(new Set(rows.map(row => row.id)).size, 23);
    await denied('getMySupportReport', parent, { reportId: foreign.reportId, cursor: first.replies.nextCursor }, 'NOT_FOUND');
    const ownOther = (await call('listMySupportReports', parent)).items.find(row => row.id !== reportId);
    await denied('getMySupportReport', parent, { reportId: ownOther.id, cursor: first.replies.nextCursor }, 'PERMISSION_DENIED');
  });
  await check('raw-report-and-reply-operation-reads-denied-to-parent', async () => {
    for (const path of [`reports/${reportId}`, `reports/${reportId}/publicReplies/${replyId}`, `supportReplyOperations/${replyId}`]) {
      const result = await fetch(`http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/${path}`,
        { headers: { authorization: `Bearer ${parent.token}` } }); assert.equal(result.status, 403);
    }
  });
  await check('contradictory-public-history-is-refused-not-silently-hidden', async () => {
    const current = await submit(), request = response(current.reportId), saved = await call('respondToReport', admin, request);
    const ref = db.collection('reports').doc(current.reportId).collection('publicReplies').doc(saved.replyId);
    await ref.update({ text: 'Contradictory stored reply.' });
    await denied('getMySupportReport', parent, { reportId: current.reportId }, 'FAILED_PRECONDITION');
    await ref.update({ text: request.text });
    await call('respondToReport', admin, response(current.reportId, { expectedStatus: 'reviewing', expectedReplyCount: 1 }));
    await ref.delete();
    await denied('getMySupportReport', parent, { reportId: current.reportId }, 'FAILED_PRECONDITION');
    // This deliberately corrupt synthetic report remains confined to the disposable runtime.
  });
  if (process.env.SGM_SUPPORT_BROWSER_TEST === 'true') {
    const { checkSupportFollowupBrowser } = await import('./local-support-followup-browser.mjs');
    browser = await checkSupportFollowupBrowser({ parent });
  }
  await check('reads-do-not-write-and-protected-records-and-claims-stay-unchanged', async () => {
    const original = await document('reports', reportId); await detail(reportId); await call('listMySupportReports', parent);
    assert.deepEqual(await document('reports', reportId), original);
    for (const [path, value] of baseline) assert.deepEqual((await db.doc(path).get()).data(), value, path);
    assert.deepEqual(await Promise.all([parent, other, admin].map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
  });
  success = true;
} finally {
  await deleteApp(getApp()); const output = process.env.SGM_LOCAL_FLOW_OUTPUT; assert(output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'local-emulated-services-not-phone-ui', coverage: 'support-written-replies-private-admin-notes',
    completed: success, checks, browser, protectedRecordCount: baseline.size, adminClientClosed: true,
    nativeUi: false, physicalDevice: false, pushDeliveryVerified: false, productionWrites: false }, null, 2) + '\n');
}
