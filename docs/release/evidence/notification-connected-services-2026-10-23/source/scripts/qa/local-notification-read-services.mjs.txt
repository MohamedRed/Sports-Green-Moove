import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { deleteApp, getApp } from 'firebase-admin/app';
import { seedLocalUiFixtures } from './local-ui-fixtures.mjs';
import { call, signIn } from './local-flow-client.mjs';
import { seedNotificationReadFixture, snapshotNotificationReadRecords, verifyNotificationReadInboxes } from './local-notification-read-ui.mjs';
import { verifyNotificationReadRecords } from './notification-read-restart-evidence.mjs';

const session = await seedLocalUiFixtures(), checks = [];
const passed = id => checks.push({id, status: 'passed'});
let result, failure;
try {
  const fixture = await seedNotificationReadFixture(), baseline = await snapshotNotificationReadRecords();
  const parent = await signIn(session.parent);
  const before = (await call('getInbox', parent)).inbox.notifications;
  for (const id of [fixture.selectedNoticeId, fixture.controlNoticeId]) assert.equal(before.find(row => row.id === id)?.unread, true);
  passed('booking-generated-owned-unread-notices');
  const request = {userId: parent.uid, notificationId: fixture.selectedNoticeId};
  assert.deepEqual(await call('markNotificationRead', parent, request), {...request, read: true});
  const first = await snapshotNotificationReadRecords(), checkpoint = verifyNotificationReadRecords(baseline, first, fixture.selectedNoticeId);
  passed('authenticated-call-changes-only-selected-read-fields');
  await verifyNotificationReadInboxes(fixture);
  assert.deepEqual(await snapshotNotificationReadRecords(), first);
  passed('fresh-inboxes-and-foreign-rejection-preserve-all-records');
  await call('markNotificationRead', parent, request);
  assert.deepEqual(await snapshotNotificationReadRecords(), first);
  passed('explicit-replay-preserves-first-server-timestamp');
  result = {projectId: session.projectId, runId: session.runId, testedAt: new Date().toISOString(),
    scope: 'authenticated-local-notification-services-not-native-ui', fixture, checkpoint, checks, completed: true,
    nativeUiExecuted: false, physicalPhoneAccepted: false, pushDeliveryAccepted: false, productionWrites: false, releaseComplete: false};
} catch (error) { failure = error; }
finally { await deleteApp(getApp()); }
if (result) writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({...result, adminClientClosed: true}, null, 2) + '\n', {flag: 'wx'});
if (failure) throw new Error(String(failure.message).replaceAll(session.password, '[REDACTED]'));
console.log('Four authenticated notification service scenarios passed; no native UI result claimed.');
