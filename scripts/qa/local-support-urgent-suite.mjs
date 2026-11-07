import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { deleteApp, getApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { auth, call, db, denied, document, signIn } from './local-flow-client.mjs';
import { deliverUrgentSupportEmail } from '../../functions/lib/services/supportUrgentDelivery.js';
import { sendSupportUrgentEmail, SupportMailError } from '../../functions/lib/services/supportMailProvider.js';
import { supportEmailWindowMs } from '../../functions/lib/domain/supportUrgentEmail.js';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
await auth.createUser({ uid: 'sgm-urgent-admin', email: 'urgent-admin@example.test', password: process.env.SGM_QA_PASSWORD });
await auth.setCustomUserClaims('sgm-urgent-admin', { roleKeys: ['admin'] });
const parent = await signIn('p@example.test'), manager = await signIn('c@example.test'), admin = await signIn('urgent-admin@example.test');
const actors = [parent, manager, admin], claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
const baseline = new Map();
for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
const input = emergency => ({ clientRequestId: randomUUID(), requesterUserId: parent.uid, subjectType: 'other',
  reason: 'Urgence support QA', description: 'Texte prive de test qui ne doit jamais figurer dans le mail.', emergency });
const config = JSON.stringify({ from: 'alerts@example.test', to: 'support@example.test', adminOrigin: 'https://qa.example.test/' });
const key = 're_synthetic_qa_key_not_real', received = new Map(), requests = [], checks = [];
let dropNext = false, completed = false;
const server = createServer(async (request, response) => {
  let body = ''; for await (const chunk of request) body += chunk;
  const identity = request.headers['idempotency-key'], message = JSON.parse(body);
  assert.equal(request.url, '/emails'); assert.equal(request.method, 'POST');
  assert.deepEqual(message.to, ['support@example.test']); assert.doesNotMatch(body, /Texte prive|reporter|club|reviewNote|password/);
  if (received.has(identity)) assert.deepEqual(received.get(identity).message, message);
  else received.set(identity, { message, id: randomUUID() });
  requests.push({ idempotencyKey: identity, recipientCount: message.to.length });
  if (dropNext) { dropNext = false; request.socket.destroy(); return; }
  response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ id: received.get(identity).id }));
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const request = (_url, options) => fetch(`http://127.0.0.1:${server.address().port}/emails`, options);
const send = (message, identity) => sendSupportUrgentEmail(message, identity, key, request);
const deliver = (id, raw = config, clock) => deliverUrgentSupportEmail(id, raw, key, send, clock);
async function check(id, action) { await action(); checks.push({ id, status: 'passed' }); console.log(id + ': passed'); }
async function waitForUnconfigured(reportId) {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error('Disabled background mail worker did not settle')); }, 15_000);
    const stop = db.collection('supportUrgentEmailOutbox').doc(reportId).onSnapshot(snapshot => {
      if (snapshot.get('status') === 'needs_configuration') { clearTimeout(timer); stop(); resolveReady(); }
    }, error => { clearTimeout(timer); reject(error); });
  });
}
try {
  await check('ordinary-report-does-not-create-an-urgent-outbox', async () => {
    const receipt = await call('submitSupportReport', parent, input(false));
    assert.equal((await db.collection('supportUrgentEmailOutbox').doc(receipt.reportId).get()).exists, false);
  });
  const action = input(true), receipts = await Promise.all([call('submitSupportReport', parent, action), call('submitSupportReport', parent, action)]);
  const reportId = receipts[0].reportId, outbox = () => document('supportUrgentEmailOutbox', reportId);
  await waitForUnconfigured(reportId);
  await check('concurrent-ui-retries-commit-one-report-and-one-support-only-mail-operation', async () => {
    assert.equal(receipts[1].reportId, reportId); assert.equal(receipts.filter(row => !row.reused).length, 1);
    const row = await outbox(); assert.equal(row.reportId, reportId); assert.equal(row.audience, 'support');
    assert.deepEqual(row.createdAt, (await document('reports', reportId)).createdAt); assert.equal(row.attempts, 0);
  });
  await check('parent-and-club-manager-cannot-read-write-or-retry-the-mail-operation', async () => {
    const url = `http://127.0.0.1:8080/v1/projects/demo-sgm-local-qa/databases/(default)/documents/supportUrgentEmailOutbox/${reportId}`;
    for (const actor of [parent, manager]) {
      assert.equal((await fetch(url, { headers: { authorization: `Bearer ${actor.token}` } })).status, 403);
      assert.equal((await fetch(url, { method: 'PATCH', headers: { authorization: `Bearer ${actor.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ fields: { audience: { stringValue: 'clubManager' } } }) })).status, 403);
      await denied('retryUrgentSupportEmail', actor, { reportId }, 'PERMISSION_DENIED');
    }
    assert.equal((await fetch(url, { headers: { authorization: `Bearer ${admin.token}` } })).status, 200);
  });
  await check('missing-email-configuration-stays-visible-without-contacting-any-provider', async () => {
    const before = requests.length;
    await deliverUrgentSupportEmail(reportId, 'not-configured', 'not-configured', send);
    const row = await outbox(); assert.equal(row.status, 'needs_configuration'); assert.equal(row.firstAttemptAt, undefined);
    assert.equal(row.attempts, 0); assert.equal(requests.length, before);
  });
  await check('lost-provider-acknowledgement-reuses-one-mail-and-the-original-recipient', async () => {
    dropNext = true; const saved = await document('reports', reportId);
    await assert.rejects(deliver(reportId), error => error instanceof SupportMailError && error.kind === 'temporary');
    assert.equal((await outbox()).status, 'queued'); assert.equal(received.size, 1);
    await deliver(reportId, JSON.stringify({ from: 'changed@example.test', to: 'changed@example.test', adminOrigin: 'https://changed.example.test/' }));
    const row = await outbox(); assert.equal(row.status, 'accepted'); assert.equal(row.attempts, 2);
    assert.equal(row.providerId, [...received.values()][0].id); assert.equal(received.size, 1); assert.equal(requests.length, 2);
    assert.deepEqual(await document('reports', reportId), saved);
    await deliver(reportId); assert.equal(requests.length, 2);
  });
  await check('legacy-report-creation-queues-the-same-support-only-escalation-atomically', async () => {
    const { clientRequestId, requesterUserId, ...legacy } = input(true);
    const receipt = await call('createReport', parent, legacy), row = await document('supportUrgentEmailOutbox', receipt.reportId);
    assert.equal(row.reportId, receipt.reportId); assert.equal(row.audience, 'support');
    assert.deepEqual(row.createdAt, (await document('reports', receipt.reportId)).createdAt);
  });
  await check('expired-ambiguous-send-requires-review-without-another-provider-request', async () => {
    const receipt = await call('submitSupportReport', parent, input(true)); dropNext = true;
    await waitForUnconfigured(receipt.reportId);
    await assert.rejects(deliver(receipt.reportId), SupportMailError);
    const ref = db.collection('supportUrgentEmailOutbox').doc(receipt.reportId), first = (await ref.get()).get('firstAttemptAt').toMillis();
    const before = requests.length; await deliver(receipt.reportId, config, () => first + supportEmailWindowMs);
    assert.equal((await ref.get()).get('status'), 'needs_review'); assert.equal(requests.length, before);
  });
  await check('concurrent-workers-cannot-send-during-an-active-lease', async () => {
    const receipt = await call('submitSupportReport', parent, input(true));
    await waitForUnconfigured(receipt.reportId);
    let release, started;
    const gate = new Promise(resolveGate => { release = resolveGate; });
    const entered = new Promise(resolveEntered => { started = resolveEntered; });
    let calls = 0;
    const held = deliverUrgentSupportEmail(receipt.reportId, config, key, async () => {
      calls++; started(); await gate; return 'synthetic-provider-lease';
    });
    try {
      await entered;
      await assert.rejects(deliver(receipt.reportId), error => error instanceof SupportMailError && error.kind === 'temporary');
      assert.equal(calls, 1);
    } finally { release(); await held; }
    assert.equal((await document('supportUrgentEmailOutbox', receipt.reportId)).status, 'accepted');
  });
  await check('invalid-queue-state-and-attempt-count-fail-before-any-provider-call', async () => {
    const receipt = await call('submitSupportReport', parent, input(true));
    await waitForUnconfigured(receipt.reportId);
    const ref = db.collection('supportUrgentEmailOutbox').doc(receipt.reportId), before = requests.length;
    await ref.update({ status: 'unexpected' }); await assert.rejects(deliver(receipt.reportId), /matching urgent request/);
    await ref.update({ status: 'queued', attempts: -1 }); await assert.rejects(deliver(receipt.reportId), /matching urgent request/);
    assert.equal(requests.length, before);
  });
  await check('current-authority-query-sees-urgent-requests-beyond-the-ordinary-fifty-row-window', async () => {
    const batch = db.batch();
    const windowId = 'z-urgent-window';
    batch.create(db.collection('reports').doc(windowId), { ...(await document('reports', reportId)), status: 'open' });
    for (let index = 0; index < 55; index++) batch.create(db.collection('reports').doc('a-ordinary-' + String(index).padStart(2, '0')),
      { reporterUserId: parent.uid, emergency: false, status: 'open', createdAt: Timestamp.now() });
    await batch.commit();
    const ordinary = await db.collection('reports').limit(50).get(); assert(!ordinary.docs.some(row => row.id === windowId));
    const urgent = await db.collection('reports').where('emergency', '==', true).where('status', 'in', ['open', 'reviewing']).orderBy('createdAt', 'asc').get();
    assert(urgent.docs.some(row => row.id === reportId)); assert(urgent.docs.some(row => row.id === windowId));
    await call('reviewReport', admin, { reportId, status: 'closed' });
    const closed = await db.collection('reports').where('emergency', '==', true).where('status', 'in', ['open', 'reviewing']).get();
    assert(!closed.docs.some(row => row.id === reportId));
  });
  await check('requester-projection-and-all-baseline-records-remain-private-and-unchanged', async () => {
    const view = await call('getMySupportReport', parent, { reportId });
    assert.doesNotMatch(JSON.stringify(view), /support@example|providerId|idempotency|firstAttempt|leaseId|audience/);
    assert.equal((await db.collection('notifications').where('userId', '==', manager.uid).get()).size, 0);
    for (const [path, value] of baseline) assert.deepEqual((await db.doc(path).get()).data(), value, path);
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
  });
  completed = true;
} finally {
  await new Promise(resolveClose => server.close(resolveClose)); server.closeAllConnections(); await deleteApp(getApp());
  const output = process.env.SGM_LOCAL_FLOW_OUTPUT; assert(output); mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID,
    testedAt: new Date().toISOString(), scope: 'local-support-urgent-services-with-explicit-loopback-mail-provider-not-real-inbox-delivery',
    completed, checks, handlerRequests: requests, simulatedEmails: received.size, protectedRecordCount: baseline.size,
    productionWrites: false, realEmailSent: false, physicalDevice: false }, null, 2) + '\n');
}
