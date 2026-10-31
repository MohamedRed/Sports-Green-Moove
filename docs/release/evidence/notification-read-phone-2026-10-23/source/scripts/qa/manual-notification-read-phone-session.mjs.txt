import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { deleteApp, getApp } from 'firebase-admin/app';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? '') && process.stdin.isTTY);
assert.equal(statSync(sessionPath).mode & 0o077, 0);
const session = JSON.parse(readFileSync(sessionPath)); assert.equal(session.projectId, 'demo-sgm-local-qa');
assert.match(session.runId, /^[a-f0-9]{32}$/); process.env.SGM_QA_PASSWORD = session.password;
const {seedNotificationReadFixture, snapshotNotificationReadRecords, verifyNotificationReadInboxes} = await import('./local-notification-read-ui.mjs');
const {verifyNotificationReadRecords} = await import('./notification-read-restart-evidence.mjs');
mkdirSync(output, {mode: 0o700});
const input = createInterface({input: process.stdin, terminal: false}), phases = ['initial', 'read', 'driver', 'reopened'];
const checkpoints = []; let completed = false, failure, fixture, baseline, first;
const stop = () => input.close(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  fixture = await seedNotificationReadFixture(); baseline = await snapshotNotificationReadRecords();
  console.log('Isolated notices ready. Observe the phone, then enter: initial, read, driver, reopened, finish.');
  console.log('This controller never marks an owned notice read and does not control the phone.');
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') { assert.equal(checkpoints.length, phases.length); completed = true; break; }
    assert.equal(phase, phases[checkpoints.length]);
    const state = await snapshotNotificationReadRecords(); let result;
    if (phase === 'initial') {
      assert.deepEqual(state, baseline); result = {selectedStillUnread: true, allRecordsUnchanged: true};
    } else {
      result = verifyNotificationReadRecords(baseline, state, fixture.selectedNoticeId);
      if (phase === 'read') first = state;
      else assert.deepEqual(state, first, 'Account changes and reopening cannot change the first read or other records');
      result.inboxes = await verifyNotificationReadInboxes(fixture);
      assert.deepEqual(await snapshotNotificationReadRecords(), state);
    }
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), scope: 'independent-notification-record-checkpoint-not-phone-ui-proof', fixture, state, result}, null, 2) + '\n',
    {mode: 0o600, flag: 'wx'});
    checkpoints.push({phase, result}); console.log('Independent notice checkpoint passed: ' + phase);
  }
} catch (error) { failure = error; }
finally {
  input.close(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  await deleteApp(getApp()); delete process.env.SGM_QA_PASSWORD;
}
const sources = ['scripts/qa/manual-notification-read-phone-session.mjs', 'scripts/qa/local-notification-read-ui.mjs',
  'scripts/qa/notification-read-restart-evidence.mjs', 'functions/src/callables/notificationRead.ts'];
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), completed: completed && !failure, checkpoints,
  scope: 'independent-notification-phone-checkpoints-not-ui-or-process-death-proof', adminClientClosed: true,
  protectedRecordCount: baseline ? Object.values(baseline.documents).reduce((n, rows) => n + rows.length, 0) : 0,
  nativeProcessIdsMeasured: false, physicalTrackingAccepted: false, pushDeliveryAccepted: false, productionWrites: false,
  sourceFiles: Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))}, null, 2) + '\n',
{mode: 0o600, flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Notification observer closed; dispose of its owned runtime and phone separately.');
