import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { supportPhonePhases, supportPhoneInput, verifySupportPhoneCheckpoint } from './manual-support-phone-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
assert(process.stdin.isTTY, 'Phone checkpoints require an interactive observer');
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, denied, signIn } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure, reviewExecuted = false, protectedRecordCount = 0;
try {
  const parent = await signIn(session.parent), admin = await signIn(session.admin);
  await call('initializeUserProfile', parent);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const claims = await Promise.all([parent, admin].map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const fixture = { parentUid: parent.uid, adminUid: admin.uid };
  console.log('Observe phone phases in order: ' + supportPhonePhases.join(', ') + '.');
  console.log('After reopened, review performs two admin SERVICE actions, not admin UI. No report is submitted by this controller.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, supportPhonePhases.length); completed = true; break; }
    if (phase === 'review') {
      assert.equal(checkpoints.length, 4); assert(!reviewExecuted); reviewExecuted = true;
      await denied('reviewReport', parent, { reportId: fixture.reportId, status: 'closed' }, 'PERMISSION_DENIED');
      for (const [status, note] of [['reviewing', 'Prise en charge du test isole.'], ['closed', 'Cloture du test isole.']])
        await call('reviewReport', admin, { reportId: fixture.reportId, status, note });
      console.log('Admin service review completed once; observe the phone before reviewed.'); continue;
    }
    assert.equal(phase, supportPhonePhases[checkpoints.length]);
    const reports = (await db.collection('reports').get()).docs.filter(row => !baseline.has(row.ref.path))
      .map(row => ({ id: row.id, ...row.data() }));
    const notifications = (await db.collection('notifications').get()).docs.filter(row => !baseline.has(row.ref.path))
      .map(row => ({ id: row.id, ...row.data() }));
    if (phase === 'submitted' && reports.length === 1) fixture.reportId = reports[0].id;
    const state = { reports, notifications };
    const result = verifySupportPhoneCheckpoint(phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if (path === `users/${parent.uid}`) {
        const { updatedAt: before, ...oldFields } = original, { updatedAt: after, ...newFields } = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all([parent, admin].map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, input: supportPhoneInput, state, result, protectedRecordCount,
      originalClaimsUnchanged: true, adminReviewViaService: reviewExecuted }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log('Independent support checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const paths = ['scripts/qa/manual-support-phone-session.mjs', 'scripts/qa/manual-support-phone-checkpoints.mjs',
  'functions/src/callables/feedback.ts', 'android/app/src/main/java/be/sportgreenmoove/app/ui/OptionsReportCard.kt'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, protectedRecordCount,
  scope: 'independent-support-record-checkpoints-not-phone-ui-proof', adminClientClosed: true,
  fixtureEnvironmentDestroyed: false, productionWrites: false, adminReviewViaService: reviewExecuted,
  requesterResponseVerified: false, sourceFiles: Object.fromEntries(paths.map(path =>
    [path, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) },
null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Support controller closed; destroy the owned local environment separately.');
