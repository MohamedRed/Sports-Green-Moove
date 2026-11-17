import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { privateSupportNote, supportFollowupPhonePhases, supportFollowupInput, supportFollowupTexts,
  verifySupportFollowupCheckpoint } from './manual-support-followup-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && !existsSync(output));
assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(process.stdin.isTTY, 'Physical checkpoints require an interactive observer');
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, denied, signIn } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [], receipts = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure, protectedRecordCount = 0;
try {
  const parent = await signIn(session.parent), admin = await signIn(session.admin), foreign = await signIn(session.driver);
  await call('initializeUserProfile', parent);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const actors = [parent, admin, foreign], claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const fixture = { parentUid: parent.uid, adminUid: admin.uid, foreignUid: foreign.uid, replyIds: [], foreignReadDenied: false };
  console.log('Observe: ' + supportFollowupPhonePhases.join(', ') + '. Commands reply / close perform explicit admin SERVICE actions only.');
  console.log('This controller never submits a support report and never proves phone UI, push or process identity by itself.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, supportFollowupPhonePhases.length); completed = true; break; }
    if (phase === 'reply' || phase === 'close') {
      const index = phase === 'reply' ? 0 : 1;
      assert.equal(checkpoints.length, index === 0 ? 3 : 4); assert.equal(receipts.length, index);
      if (index === 0) await call('reviewReport', admin, { reportId: fixture.reportId, status: 'reviewing', note: privateSupportNote });
      const receipt = await call('respondToReport', admin, { reportId: fixture.reportId, requestId: randomUUID(),
        text: supportFollowupTexts[index], expectedStatus: 'reviewing', expectedReplyCount: index, status: index === 0 ? 'reviewing' : 'closed' });
      assert.equal(receipt.reused, false); assert.equal(receipt.reply.sequence, index + 1);
      receipts.push(receipt); fixture.replyIds.push(receipt.replyId);
      console.log('One public response recorded through the admin service; observe the native requester before the next checkpoint.'); continue;
    }
    assert.equal(phase, supportFollowupPhonePhases[checkpoints.length]);
    const reports = (await db.collection('reports').get()).docs.filter(row => !baseline.has(row.ref.path)).map(row => ({ id: row.id, ...row.data() }));
    const notifications = (await db.collection('notifications').get()).docs.filter(row => !baseline.has(row.ref.path)).map(row => ({ id: row.id, ...row.data() }));
    if (phase === 'submitted' && reports.length === 1) fixture.reportId = reports[0].id;
    let requesterView = null, replies = [], foreignList = null;
    if (fixture.reportId) {
      requesterView = await call('getMySupportReport', parent, { reportId: fixture.reportId });
      replies = (await db.collection('reports').doc(fixture.reportId).collection('publicReplies').get()).docs.map(row => ({ id: row.id, ...row.data() }));
    }
    if (phase === 'foreign') {
      await denied('getMySupportReport', foreign, { reportId: fixture.reportId }, 'NOT_FOUND'); fixture.foreignReadDenied = true;
      foreignList = await call('listMySupportReports', foreign);
    }
    const state = { reports, replies, notifications, requesterView, foreignList };
    const result = verifySupportFollowupCheckpoint(phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if ([parent, foreign].some(actor => path === `users/${actor.uid}`)) {
        const { updatedAt: before, ...oldFields } = original, { updatedAt: after, ...newFields } = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, input: supportFollowupInput, state, result, protectedRecordCount,
      originalClaimsUnchanged: true, adminResponsesViaService: receipts.length }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log('Independent follow-up checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-support-followup-session.mjs', 'scripts/qa/manual-support-followup-checkpoints.mjs',
  'functions/src/services/supportReports.ts', 'functions/src/domain/supportReports.ts',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/SupportInboxScreen.kt', 'android/app/src/main/java/be/sportgreenmoove/app/ui/SupportInboxState.kt'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, receipts, protectedRecordCount,
  scope: 'independent-support-followup-record-checkpoints-not-phone-ui-proof', adminClientClosed: true,
  fixtureEnvironmentDestroyed: false, productionWrites: false, adminResponsesViaService: receipts.length,
  pushDeliveryVerified: false, processIdentityVerified: false, sourceFiles: Object.fromEntries(paths.map(path =>
    [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Controller closed; dispose the owned local environment separately.');
