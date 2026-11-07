import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDatabase } from 'firebase-admin/database';
import { auth, call, db, denied, signIn, tripInput, viewedBooking } from './local-flow-client.mjs';
import { snapshotSessionRestorationRecords } from './session-restoration-records.mjs';
import { stopDisposableAppProcess } from './local-disposable-process-stop.mjs';
import { assertPreparedNotificationRead, assertNotificationReadRestart, verifyNotificationReadRecords } from './notification-read-restart-evidence.mjs';

export async function seedNotificationReadFixture() {
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test');
  const ids = [];
  for (const label of ['Lecture choisie QA', 'Autre alerte non lue QA']) {
    const {tripId} = await call('createTrip', driver, {...tripInput(), title: label});
    const {bookingId} = await call('requestBooking', parent, await viewedBooking(parent, {tripId, childId: 'sgm-qa-child-lina', seats: 2}));
    await call('approveBooking', driver, {bookingId});
    const notices = await db.collection('notifications').where('sourceId', '==', bookingId).get();
    const addressed = notices.docs.filter(row => row.get('userId') === parent.uid && row.get('type') === 'bookingApproved');
    assert.equal(addressed.length, 1); assert.equal(addressed[0].get('read'), false);
    ids.push({noticeId: addressed[0].id, bookingId});
  }
  await call('cancelBooking', parent, {bookingId: ids[1].bookingId});
  const driverNotes = await db.collection('notifications').where('sourceId', '==', ids[1].bookingId)
    .where('userId', '==', driver.uid).where('type', '==', 'bookingCancelled').get();
  assert.equal(driverNotes.size, 1); assert.equal(driverNotes.docs[0].get('read'), false);
  return {selectedNoticeId: ids[0].noticeId, controlNoticeId: ids[1].noticeId, driverNoticeId: driverNotes.docs[0].id};
}

export async function snapshotNotificationReadRecords() {
  const state = await snapshotSessionRestorationRecords(db, auth, getDatabase());
  // Both explicit account logins initialize their own profile timestamp; all other fields remain protected.
  for (const row of state.documents.users ?? []) if (row.id === 'sgm-qa-driver') delete row.data.updatedAt;
  return state;
}

export async function verifyNotificationReadInboxes(fixture) {
  const parent = await signIn('p@example.test'), driver = await signIn('d@example.test'), outsider = await signIn('outsider@example.test');
  const own = (await call('getInbox', parent)).inbox.notifications;
  assert.equal(own.find(row => row.id === fixture.selectedNoticeId)?.unread, false);
  assert.equal(own.find(row => row.id === fixture.controlNoticeId)?.unread, true);
  const driverNotes = (await call('getInbox', driver)).inbox.notifications;
  assert(!driverNotes.some(row => [fixture.selectedNoticeId, fixture.controlNoticeId].includes(row.id)));
  assert.equal(driverNotes.find(row => row.id === fixture.driverNoticeId)?.unread, true);
  const foreign = (await call('getInbox', outsider)).inbox.notifications;
  assert(!foreign.some(row => [fixture.selectedNoticeId, fixture.controlNoticeId, fixture.driverNoticeId].includes(row.id)));
  for (const actor of [driver, outsider]) await denied('markNotificationRead', actor,
    {userId: actor.uid, notificationId: fixture.selectedNoticeId}, 'NOT_FOUND');
  await denied('markNotificationRead', driver, {userId: parent.uid, notificationId: fixture.selectedNoticeId}, 'PERMISSION_DENIED');
  return {parentConfirmedRead: true, otherNoticeUnread: true, driverInboxScoped: true, outsiderInboxScoped: true, foreignWritesDenied: true};
}

export async function replayNotificationReadUi({instrument, collect, adb, serial, directory, runId}) {
  const save = (file, data) => writeFileSync(resolve(directory, file), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
  const load = file => JSON.parse(readFileSync(resolve(directory, file)));
  const fixture = await seedNotificationReadFixture(), baseline = await snapshotNotificationReadRecords();
  const args = Object.entries(fixture).flatMap(([key, value]) => ['-e', key, value]);
  instrument(['LocalNotificationReadFlowTest#readSelectedNotificationAndSwitchAccounts'], 1, args);
  const first = await snapshotNotificationReadRecords();
  const checkpoint = verifyNotificationReadRecords(baseline, first, fixture.selectedNoticeId);
  const firstInbox = await verifyNotificationReadInboxes(fixture);
  save('notification-read-checkpoint.json', {projectId: 'demo-sgm-local-qa', runId, fixture, checkpoint, inboxes: firstInbox});
  stopDisposableAppProcess({adb, serial, runId, outputDir: directory,
    beforeName: 'local-notification-read-before.json', validateBefore: assertPreparedNotificationRead});
  instrument(['LocalNotificationReadFlowTest#reopenReadNotificationAfterProcessDeath'], 1, args);
  collect();
  const before = load('local-notification-read-before.json'), stopped = load('local-notification-read-stop.json');
  const after = load('local-notification-read-after.json');
  assertNotificationReadRestart(before, stopped, after, fixture, runId);
  const final = await snapshotNotificationReadRecords(), persisted = verifyNotificationReadRecords(baseline, final, fixture.selectedNoticeId);
  assert.deepEqual(final, first, 'Restart and server refresh must preserve the original timestamp and every protected record');
  const finalInbox = await verifyNotificationReadInboxes(fixture);
  assert.deepEqual(await snapshotNotificationReadRecords(), final, 'Rejected foreign requests may not change any record');
  save('notification-read-records.json', {baseline, afterRead: first, afterRestart: final});
  const captureFiles = ['unread', 'confirmed', 'driver', 'parent-return', 'restarted'].map(phase => `local-notification-read-${phase}.png`);
  for (const file of captureFiles) {
    const bytes = readFileSync(resolve(directory, file));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
  }
  const result = {projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    scope: 'connected-local-native-notification-read-with-real-sdk-not-physical-or-push',
    nativeCaseCount: 2, fixture, native: {before, stopped, after}, checkpoint, persisted, inboxes: finalInbox, captureFiles,
    profileTimestampExceptions: ['sgm-qa-parent', 'sgm-qa-driver'], completed: true,
    physicalPhoneAccepted: false, pushDeliveryAccepted: false, productionWrites: false, releaseComplete: false};
  save('notification-read-ui-stage.json', result);
  return result;
}
