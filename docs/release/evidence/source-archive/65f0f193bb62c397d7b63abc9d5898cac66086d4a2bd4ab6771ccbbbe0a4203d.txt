import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './local-flow-client.mjs';
import { Timestamp } from 'firebase-admin/firestore';
import { emergencyContactId, emergencyContactRecordSchema } from '../../functions/lib/domain/emergencyContact.js';
import { assertInstrumentationPassed } from './android-instrumentation-result.mjs';
import { validateRideEmergencyDevice } from './ride-emergency-evidence.mjs';

export async function verifyRideEmergencyStoredState() {
  const contacts = await db.collection('emergencyContacts').get();
  const operations = await db.collection('emergencyContactOperations').get();
  assert.equal(contacts.size, 2); assert.equal(operations.size, 4);
  const ids = [];
  for (const role of ['driver', 'parent']) {
    const uid = `sgm-qa-${role}`, id = emergencyContactId('self', uid); ids.push(id);
    const record = contacts.docs.find((doc) => doc.id === id); assert(record);
    emergencyContactRecordSchema.parse(record.data());
    assert.equal(record.get('kind'), 'self'); assert.equal(record.get('subjectId'), uid);
    assert.equal(record.get('contact'), null); assert.equal(record.get('revision'), 2);
    assert.equal(record.get('lastActorUserId'), uid); assert.equal(record.get('childInstanceId'), undefined);
    const writes = operations.docs.filter((doc) => doc.get('contactId') === id);
    assert.deepEqual(writes.map((doc) => doc.get('revision')).sort(), [1, 2]);
    assert(writes.every((doc) => doc.get('actorUserId') === uid));
    for (const operation of writes) {
      assert.match(operation.id, /^[a-f0-9]{64}$/); assert.match(operation.get('fingerprint'), /^[a-f0-9]{64}$/);
      assert(operation.get('createdAt') instanceof Timestamp);
      assert.deepEqual(Object.keys(operation.data()).sort(), ['actorUserId', 'contactId', 'createdAt', 'fingerprint', 'revision']);
    }
    const ordered = writes.sort((a, b) => a.get('revision') - b.get('revision'));
    assert(record.get('createdAt').isEqual(ordered[0].get('createdAt')));
    assert(record.get('updatedAt').isEqual(ordered[1].get('createdAt')));
    assert(record.get('updatedAt').toMillis() >= record.get('createdAt').toMillis());
  }
  assert(operations.docs.every((doc) => ids.includes(doc.get('contactId'))));
  return { contactCount: contacts.size, operationCount: operations.size, contactValuesRemoved: true };
}

export async function verifyRideEmergencyUi(directory, runId, ride) {
  const read = (file) => readFileSync(resolve(directory, file));
  const marker = JSON.parse(read('local-ride-emergency-device.json'));
  const receipt = JSON.parse(read('adb-pull-ride-emergency.json'));
  validateRideEmergencyDevice(marker, receipt, runId, ride, read);
  const transcript = read('LocalRideFlowTest-instrumentation.txt');
  assertInstrumentationPassed(transcript.toString(), 1);
  await verifyRideEmergencyStoredState();
  const files = ['scripts/qa/verify-ride-emergency-ui.mjs', 'scripts/qa/ride-emergency-evidence.mjs',
    'scripts/qa/verify-local-ride-ui.mjs', 'scripts/qa/local-android-session.mjs',
    'functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContact.ts',
    ...['LocalRideFlowTest.kt', 'LocalRideEmergencyUi.kt', 'LocalEmergencyEvidence.kt', 'LocalExternalUiWait.kt', 'LocalUiCapture.kt']
      .map((file) => 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/' + file),
    ...['SportsGreenMooveApp.kt', 'RideMonitorScreen.kt', 'EmergencyContactRoute.kt', 'EmergencyContactState.kt']
      .map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/ui/' + file)];
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const report = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    scope: 'local-active-ride-contact-with-sdk-and-dialer-not-physical', testCount: 1, nativeCaseCount: 1,
    steps: [{ id: 'ride-emergency-active-ui', status: 'passed' }], actors: marker.actors,
    screenshots: marker.screenshots, transcriptSha256: sha(transcript), privateOperationsVerified: 4,
    contactValuesRemoved: true, contactNullRevisionsRetained: true, rideCompletionVerifiedSeparately: true,
    childOwnAccountDialImplemented: false, physicalDevice: false, productionWrites: false, storeReviewAccepted: false,
    sourceFiles: Object.fromEntries(files.map((file) => [file, sha(readFileSync(resolve(import.meta.dirname, '../..', file)))])) };
  writeFileSync(resolve(directory, 'ride-emergency-results.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
