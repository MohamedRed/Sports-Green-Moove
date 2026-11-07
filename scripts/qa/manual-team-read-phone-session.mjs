import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { teamReadPhonePhases, teamReadPhoneIncoming, verifyTeamReadPhoneCheckpoint } from './manual-team-read-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { prepareTeamChatUiFixture, verifyTeamChatProtectedBaseline } = await import('./team-conversation-ui-fixture.mjs');
const { call, db } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 });
const sourcePaths = ['scripts/qa/manual-team-read-phone-session.mjs', 'scripts/qa/manual-team-read-checkpoints.mjs',
  'scripts/qa/team-conversation-ui-fixture.mjs', 'functions/src/services/teamConversationRead.ts',
  'functions/src/services/teamConversation.ts', 'functions/src/services/teamConversationAuthority.ts',
  'functions/src/services/teamConversationOptions.ts'];
const sourceFiles = Object.fromEntries(sourcePaths.map(file => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const input = createInterface({ input: process.stdin, terminal: false }), checkpoints = [];
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
let completed = false, failure;
try {
  const fixture = await prepareTeamChatUiFixture();
  const root = db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId);
  console.log('Team reads ready. Observe phone UI, then enter in order: ' + teamReadPhonePhases.join(', ') + '.');
  console.log('After parent-read, leave the thread on the phone before entering publish. Finish with finish or stop.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, teamReadPhonePhases.length); completed = true; break; }
    if (phase === 'publish') {
      assert.equal(checkpoints.length, 2); assert.equal(fixture.newMessageId, undefined, 'Never retry an unknown send outcome');
      fixture.newMessageId = (await call('sendTeamChatMessage', fixture.driver, { ...fixture.target,
        body: teamReadPhoneIncoming, clientMessageId: randomUUID() })).messageId;
      console.log('One driver message published through the isolated service; observe the phone before new-unread.'); continue;
    }
    assert.equal(phase, teamReadPhonePhases[checkpoints.length], 'Checkpoints must execute once in order');
    if (checkpoints.length >= 2) assert.match(fixture.newMessageId ?? '', /^[a-f0-9]{64}$/);
    const entries = (await root.collection('entries').orderBy('sequence').get()).docs.map(row => ({ id: row.id,
      senderUserId: row.get('senderUserId'), body: row.get('body'), sequence: row.get('sequence'), clientMessageId: row.get('clientMessageId'),
      createdAtSeconds: row.get('createdAt').seconds, createdAtNanos: row.get('createdAt').nanoseconds }));
    const receipts = (await root.collection('readReceipts').get()).docs.map(row => ({ id: row.id,
      userId: row.get('userId'), messageId: row.get('messageId'), messageCreatedAtSeconds: row.get('messageCreatedAt').seconds,
      messageCreatedAtNanos: row.get('messageCreatedAt').nanoseconds, readAtSeconds: row.get('readAt').seconds,
      readAtNanos: row.get('readAt').nanoseconds }));
    const pages = {}, counts = {};
    for (const actor of [fixture.parent, fixture.driver, fixture.otherParent]) {
      pages[actor.uid] = await call('getTeamChatMessages', actor, fixture.target);
      let cursor, option;
      do {
        const page = await call('listTeamChatOptions', actor, { kind: 'teams', clubId: fixture.clubId, ...(cursor ? { cursor } : {}) });
        option = page.items.find(item => item.id === fixture.target.teamId); cursor = page.nextCursor;
      } while (!option && cursor);
      assert(option); counts[actor.uid] = option.unreadCount;
    }
    const state = { entries, receipts, pages, counts, parentMessageId: entries.find(row => row.senderUserId === fixture.parent.uid)?.id ?? null,
      operationIds: (await db.collection('teamMessageOperations').where('teamInstanceId', '==', fixture.target.expectedTeamInstanceId).get()).docs.map(row => row.id),
      lastSequence: (await root.get()).get('lastSequence') };
    const result = verifyTeamReadPhoneCheckpoint(phase, state, fixture);
    const receipt = { scope: 'independent-isolated-team-read-records-not-phone-ui-proof', projectId: session.projectId,
      runId: session.runId, recordedAt: new Date().toISOString(), result, state,
      isolation: await verifyTeamChatProtectedBaseline(fixture), phoneUiProven: false, controllerMarksReads: false };
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log('Independent read checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  scope: 'manual-team-read-record-checkpoints-not-ui-or-release-proof', testedAt: new Date().toISOString(),
  completed: completed && !failure, checkpoints, sourceFiles, adminClientClosed: true,
  cleanupMode: 'destroy-owned-local-environment-after-session', fixtureEnvironmentDestroyed: false,
  productionWrites: false, physicalUiProvenByThisReport: false, notificationsVerified: false,
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Team read record session closed; independently destroy and verify its owned local environment.');
