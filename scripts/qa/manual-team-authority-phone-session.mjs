import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { teamAuthorityPhases, teamAuthorityIncoming, verifyTeamAuthorityCheckpoint } from './manual-team-authority-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
assert(process.stdin.isTTY, 'Keep an interactive controller open for actual phone observations');
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { prepareTeamChatUiFixture, verifyTeamChatProtectedBaseline } = await import('./team-conversation-ui-fixture.mjs');
const { call, db } = await import('./local-flow-client.mjs');
const { guardianVerificationId } = await import('../../functions/lib/domain/guardianVerification.js');
mkdirSync(output, { mode: 0o700 });
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [], actions = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
const paths = ['scripts/qa/manual-team-authority-phone-session.mjs', 'scripts/qa/manual-team-authority-checkpoints.mjs',
  'scripts/qa/team-conversation-ui-fixture.mjs', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversation.ts', 'functions/src/services/guardianVerification.ts'];
const sourceFiles = Object.fromEntries(paths.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
let completed = false, failure;
try {
  const f = await prepareTeamChatUiFixture();
  const root = db.collection('teamConversations').doc(f.target.expectedTeamInstanceId);
  const reference = { clubId: f.clubId, childId: f.childId, parentUserId: f.parent.uid };
  const identity = { earlyMessageId: f.earlyMessageId, initialMessageId: f.initialMessageId,
    parentUid: f.parent.uid, driverUid: f.driver.uid };
  console.log('Observe phone UI before each checkpoint: initial, revoked, renewed, new-message, replied.');
  console.log('Use revoke after initial, renew after revoked, publish after renewed. Then finish or stop.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, teamAuthorityPhases.length); completed = true; break; }
    if (['revoke', 'renew', 'publish'].includes(phase)) {
      const index = ['revoke', 'renew', 'publish'].indexOf(phase);
      assert.equal(checkpoints.length, index + 1); assert.equal(actions.length, index, 'Never repeat an unknown write');
      actions.push(phase);
      if (phase === 'publish') identity.newMessageId = (await call('sendTeamChatMessage', f.driver,
        {...f.target, body: teamAuthorityIncoming, clientMessageId: randomUUID()})).messageId;
      else for (const [action, revision, actor] of phase === 'revoke' ? [['revoke', 2, f.manager]] :
        [['request', 3, f.parent], ['verify', 4, f.manager]])
        await call('transitionGuardianVerification', actor, {...reference, action, expectedRevision: revision, requestId: randomUUID()});
      console.log('Authenticated isolated service action completed: ' + phase + '. This is not manager UI proof.'); continue;
    }
    assert.equal(phase, teamAuthorityPhases[checkpoints.length]);
    assert.equal(actions.length, Math.min(checkpoints.length, 3));
    let page, parentDenied = false;
    try { page = await call('getTeamChatMessages', f.parent, f.target); }
    catch (error) { assert.equal(error.code, 'PERMISSION_DENIED'); parentDenied = true; }
    const other = await call('getTeamChatMessages', f.otherParent, f.target);
    const entries = (await root.collection('entries').orderBy('sequence').get()).docs.map(row => ({id: row.id,
      senderUserId: row.get('senderUserId'), body: row.get('body'), sequence: row.get('sequence'), clientMessageId: row.get('clientMessageId')}));
    const guardian = (await db.collection('guardianVerifications').doc(guardianVerificationId(f.clubId, f.childId, f.parent.uid)).get()).data();
    const state = {guardian: {status: guardian.status, revision: guardian.revision}, parentDenied,
      parentMessageIds: page?.items.map(row => row.id) ?? [], otherParentMessageIds: other.items.map(row => row.id), entries,
      parentMessageId: entries.find(row => row.senderUserId === f.parent.uid)?.id ?? null,
      operationIds: (await db.collection('teamMessageOperations').where('teamInstanceId', '==', f.target.expectedTeamInstanceId).get()).docs.map(row => row.id),
      lastSequence: (await root.get()).get('lastSequence')};
    const result = verifyTeamAuthorityCheckpoint(phase, state, identity);
    const receipt = {projectId: session.projectId, runId: session.runId, recordedAt: new Date().toISOString(), result,
      state, identity: {...identity}, isolation: await verifyTeamChatProtectedBaseline(f), phoneUiProven: false};
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify(receipt, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    checkpoints.push(result); console.log('Independent authority checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'independent-team-authority-records-not-phone-ui-proof',
  completed: completed && !failure, checkpoints, actions, sourceFiles, adminClientClosed: true,
  cleanupMode: 'destroy-owned-local-environment-after-session', fixtureEnvironmentDestroyed: false,
  productionWrites: false, phoneUiProven: false, managerUiProven: false, twoPhoneFlowVerified: false,
  notificationsVerified: false, releaseEvidenceAccepted: false}, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Authority record session closed; independently destroy its owned local environment.');
