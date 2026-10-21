import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';
import { verifyManualTeamDraftViews } from './manual-team-draft-views.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { prepareTeamChatUiFixture } = await import('./team-conversation-ui-fixture.mjs');
const { verifyTeamDraftRecords } = await import('./team-draft-native-records.mjs');
const { call, db } = await import('./local-flow-client.mjs');
mkdirSync(output, { mode: 0o700 });
const phases = ['before', 'unsent', 'reopened', 'sent', 'cleared', 'other-account'];
const sourceFiles = Object.fromEntries(['manual-team-draft-phone-session.mjs', 'team-conversation-ui-fixture.mjs',
  'team-draft-native-records.mjs', 'manual-team-draft-views.mjs'].map(file => ['scripts/qa/' + file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, file))).digest('hex')]));
const checkpoints = [], input = createInterface({ input: process.stdin, terminal: false });
let completed = false, failure;
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  const fixture = await prepareTeamChatUiFixture();
  console.log('Isolated team conversation ready. Enter one observed checkpoint in order: ' + phases.join(', ') + ', finish or stop.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, phases.length); completed = true; break; }
    assert.equal(phase, phases[checkpoints.length], 'Checkpoints must execute once in order');
    const sent = phases.indexOf(phase) >= phases.indexOf('sent');
    const driverView = await call('getTeamChatMessages', fixture.driver, fixture.target);
    const parentView = await call('getTeamChatMessages', fixture.parent, fixture.target);
    const messageId = verifyManualTeamDraftViews(driverView, parentView, fixture, sent);
    if (sent) {
      const row = await db.collection('teamConversations').doc(fixture.target.expectedTeamInstanceId).collection('entries').doc(messageId).get();
      assert.equal(row.get('senderUserId'), fixture.parent.uid);
    }
    const persisted = await verifyTeamDraftRecords(fixture, messageId);
    const receipt = { scope: 'independent-isolated-record-checkpoint-not-phone-ui-proof', projectId: session.projectId,
      runId: session.runId, recordedAt: new Date().toISOString(), phase, messageId, persisted,
      preAdmissionMessageHiddenForParent: true, separateDriverServiceRead: true, phoneUiProven: false };
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(receipt); console.log('Persisted checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({
  scope: 'manual-team-draft-record-checkpoints-not-ui-or-release-proof', projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints, sourceFiles,
  cleanupMode: 'destroy-owned-local-environment-after-session', adminClientClosed: true,
  fixtureEnvironmentDestroyed: false, productionWrites: false, physicalUiProvenByThisReport: false,
  fullProcessRestartProvenByThisReport: false, notificationsVerified: false,
}, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Team record session closed; stop the owned local environment and independently verify cleanup.');
