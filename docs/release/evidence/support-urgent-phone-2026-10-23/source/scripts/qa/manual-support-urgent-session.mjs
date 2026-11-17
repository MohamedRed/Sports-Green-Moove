import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { urgentPhonePhases, urgentPhoneInput, urgentPhoneReply, verifyUrgentPhoneCheckpoint } from './manual-support-urgent-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && !existsSync(output));
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(process.stdin.isTTY, 'A phone observer must be interactive');
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, denied, signIn } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 }); const input = createInterface({ input: process.stdin, terminal: false });
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
const checkpoints = []; let completed = false, failure, protectedRecordCount = 0;
try {
  const parent = await signIn(session.parent), admin = await signIn(session.admin), foreign = await signIn(session.driver), manager = await signIn(session.manager);
  await call('initializeUserProfile', parent);
  const actors = [parent, admin, foreign, manager], claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const fixture = { parentUid: parent.uid, adminUid: admin.uid, foreignUid: foreign.uid, managerUid: manager.uid, foreignReadDenied: false };
  const fresh = async collection => (await db.collection(collection).get()).docs.filter(row => !baseline.has(row.ref.path))
    .map(row => ({ id: row.id, ...row.data() }));
  console.log('Observe: ' + urgentPhonePhases.join(', ') + '. All writes must come from the actual app/management UI.');
  console.log('This observer never submits, reviews, responds, retries mail, controls the phone or proves visible state.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, urgentPhonePhases.length); completed = true; break; }
    assert.equal(phase, urgentPhonePhases[checkpoints.length]);
    const reports = await fresh('reports'), operations = await fresh('supportSubmissionOperations'), outbox = await fresh('supportUrgentEmailOutbox');
    const replyOperations = await fresh('supportReplyOperations'), notifications = await fresh('notifications');
    if (phase === 'submitted') {
      assert.equal(reports.length, 1); assert.equal(operations.length, 1);
      fixture.reportId = reports[0].id; fixture.originalOperation = operations[0]; fixture.originalCreatedAt = reports[0].createdAt;
    }
    let requesterView = null, replies = [], foreignList = null;
    if (fixture.reportId) {
      requesterView = await call('getMySupportReport', parent, { reportId: fixture.reportId });
      replies = (await db.collection('reports').doc(fixture.reportId).collection('publicReplies').get()).docs.map(row => ({ id: row.id, ...row.data() }));
      if (phase === 'answered') { assert.equal(replies.length, 1); fixture.replyId = replies[0].id; }
      await denied('retryUrgentSupportEmail', manager, { reportId: fixture.reportId }, 'PERMISSION_DENIED');
    }
    if (phase === 'foreign') {
      await denied('getMySupportReport', foreign, { reportId: fixture.reportId }, 'NOT_FOUND'); fixture.foreignReadDenied = true;
      foreignList = await call('listMySupportReports', foreign);
    }
    const state = { reports, operations, outbox, replyOperations, replies, requesterView, foreignList, notifications };
    const result = verifyUrgentPhoneCheckpoint(phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if (actors.some(actor => path === `users/${actor.uid}`) && original.updatedAt) {
        const { updatedAt: before, ...oldFields } = original, { updatedAt: after, ...newFields } = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, state, result, protectedRecordCount, originalClaimsUnchanged: true,
      physicalUiVerifiedByObserver: false, adminWritesByObserver: 0, realEmailSent: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    checkpoints.push(result); console.log('Independent urgent-support checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-urgent-support-record-checkpoints-not-phone-or-management-ui-proof',
  completed: completed && !failure, checkpoints, input: urgentPhoneInput, reply: urgentPhoneReply, protectedRecordCount,
  adminClientClosed: true, adminWritesByObserver: 0, realEmailSent: false, productionWrites: false,
  physicalUiVerifiedByObserver: false, fixtureEnvironmentDestroyed: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Observer closed; dispose the owned phone/helper/backend separately.');
