import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { supportRecoveryProtocol, verifySupportProtocolCheckpoint, assertSupportResponseRelease } from './support-recovery-protocol.mjs';

const [sessionPath, gate, output, scenario] = process.argv.slice(2);
assert([3, 4].includes(process.argv.slice(2).length));
const protocol = supportRecoveryProtocol(scenario);
for (const path of [sessionPath, gate, output]) assert(isAbsolute(path ?? ''));
assert(!existsSync(output)); assert.equal(statSync(sessionPath).mode & 0o077, 0); assert(process.stdin.isTTY);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const { auth, call, db, denied, signIn } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 }); const input = createInterface({ input: process.stdin, terminal: false });
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
const checkpoints = []; let completed = false, failure, protectedRecordCount = 0;
const gateJson = name => existsSync(resolve(gate, name)) ? JSON.parse(readFileSync(resolve(gate, name))) : null;
try {
  const parent = await signIn(session.parent), foreign = await signIn(session.driver);
  await call('initializeUserProfile', parent);
  const baseline = new Map();
  for (const collection of await db.listCollections()) for (const row of (await collection.get()).docs) baseline.set(row.ref.path, row.data());
  const actors = [parent, foreign], claims = await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims));
  const fixture = { runId: session.runId, parentUid: parent.uid, foreignUid: foreign.uid, foreignReadDenied: false };
  console.log('Observe: ' + protocol.phases.join(', ') + '. After observing ' + protocol.releaseAfter + ', release unlocks the REAL handler response.');
  console.log('This controller never submits a report, changes the phone network, or proves phone UI/network state by itself.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, protocol.phases.length); completed = true; break; }
    if (phase === 'release') {
      assertSupportResponseRelease(protocol, checkpoints); assert(fixture.reportId); assert(!gateJson('expired.json'));
      writeFileSync(resolve(gate, 'release.json'), JSON.stringify({ runId: session.runId, reportId: fixture.reportId }) + '\n', { flag: 'wx', mode: 0o600 });
      console.log('Real handler response released. Observe the native app before recording another checkpoint.'); continue;
    }
    assert.equal(phase, protocol.phases[checkpoints.length]);
    const fresh = async collection => (await db.collection(collection).get()).docs.filter(row => !baseline.has(row.ref.path))
      .map(row => ({ id: row.id, ...row.data() }));
    const reports = await fresh('reports'), operations = await fresh('supportSubmissionOperations');
    const held = gateJson('held.json');
    if (phase === 'committed') {
      assert.equal(reports.length, 1); assert.equal(operations.length, 1);
      fixture.reportId = reports[0].id; fixture.requestId = operations[0].clientRequestId;
      fixture.originalReport = reports[0]; fixture.originalOperation = operations[0];
    }
    let requesterView = null, foreignList = null, replies = [];
    if (fixture.reportId) {
      requesterView = await call('getMySupportReport', parent, { reportId: fixture.reportId });
      replies = (await db.collection('reports').doc(fixture.reportId).collection('publicReplies').get()).docs.map(row => ({ id: row.id, ...row.data() }));
    }
    if (phase === 'foreign') {
      await denied('getMySupportReport', foreign, { reportId: fixture.reportId }, 'NOT_FOUND'); fixture.foreignReadDenied = true;
      foreignList = await call('listMySupportReports', foreign);
    }
    const attempts = readdirSync(gate).filter(file => /^attempt-[a-f0-9-]+\.json$/.test(file)).map(file => gateJson(file));
    const state = { reports, operations, attempts, held, released: gateJson('released.json'), expired: !!gateJson('expired.json'),
      notifications: await fresh('notifications'), requesterView, foreignList, replies };
    const result = verifySupportProtocolCheckpoint(protocol, phase, state, fixture);
    for (const [path, original] of baseline) {
      const current = (await db.doc(path).get()).data();
      if (actors.some(actor => path === `users/${actor.uid}`)) {
        const { updatedAt: before, ...oldFields } = original, { updatedAt: after, ...newFields } = current;
        assert(after.toMillis() >= before.toMillis()); assert.deepEqual(newFields, oldFields, path);
      } else assert.deepEqual(current, original, path);
    }
    assert.deepEqual(await Promise.all(actors.map(async actor => (await auth.getUser(actor.uid)).customClaims)), claims);
    protectedRecordCount = baseline.size;
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), fixture, state, result, protectedRecordCount, originalClaimsUnchanged: true }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    checkpoints.push(result); console.log('Independent support recovery checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-support-recovery-record-checkpoints-not-phone-network-proof', scenario: protocol.scenario,
  completed: completed && !failure, checkpoints, protectedRecordCount, adminClientClosed: true, productionWrites: false,
  physicalNetworkStateVerifiedByController: false, processIdentityVerified: false, fixtureEnvironmentDestroyed: false }, null, 2) + '\n',
{ flag: 'wx', mode: 0o600 });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Support recovery controller closed; dispose the phone and owned environment separately.');
