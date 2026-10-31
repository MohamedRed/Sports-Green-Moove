import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth, db } from './local-flow-client.mjs';
import { guardianVerificationId } from '../../functions/lib/domain/guardianVerification.js';
import { readGuardianParentDevice } from './guardian-parent-evidence.mjs';

export async function replayGuardianParentUi({ instrument, collect, directory, runId }) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  const clubId = 'sgm-qa-club-green-wavre', childId = 'sgm-qa-child-lina', parentUserId = 'sgm-qa-parent';
  const id = guardianVerificationId(clubId, childId, parentUserId);
  assert(!(await db.collection('guardianVerifications').doc(id).get()).exists, 'Guardian UI starts without a verification');
  assert.equal((await db.collection('guardianVerificationEvents').get()).size, 0);
  const protectedState = async () => {
    const result = {};
    for (const name of ['children', 'clubs', 'memberships', 'teams', 'bookings', 'notifications'])
      result[name] = (await db.collection(name).orderBy('__name__').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return result;
  };
  const before = await protectedState();
  instrument(['LocalGuardianVerificationFlowTest'], 1);
  collect();
  const marker = readGuardianParentDevice(directory, runId);
  const record = await db.collection('guardianVerifications').doc(id).get();
  assert.equal(record.get('status'), 'revoked'); assert.equal(record.get('revision'), 8);
  const events = (await db.collection('guardianVerificationEvents').get()).docs.sort((a, b) => a.get('revision') - b.get('revision'));
  assert.equal(events.length, 8);
  const actions = ['request', 'refuse', 'request', 'verify', 'withdraw', 'request', 'verify', 'revoke'];
  for (const [index, event] of events.entries()) {
    assert.equal(event.get('verificationId'), id); assert.equal(event.get('revision'), index + 1);
    assert.equal(event.get('action'), actions[index]);
    assert.equal(event.get('actorUserId'), ['request', 'withdraw'].includes(actions[index]) ? parentUserId : 'sgm-qa-club-manager');
  }
  assert.deepEqual(await protectedState(), before);
  assert.deepEqual((await auth.getUser(parentUserId)).customClaims.roleKeys, ['parent']);
  const transcript = readFileSync(resolve(directory, 'LocalGuardianVerificationFlowTest-instrumentation.txt'));
  const sources = ['functions/src/services/guardianParent.ts', 'functions/src/callables/guardianParent.ts',
    'android/app/src/main/java/be/sportgreenmoove/app/data/GuardianVerificationModels.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidGuardianGateway.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/services/GuardianVerificationWire.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianVerificationState.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianPageState.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianVerificationScreen.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianVerificationDialogs.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/GuardianVerificationRoute.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalGuardianVerificationFlowTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalGuardianPeer.kt'];
  const result = { projectId: 'demo-sgm-local-qa', runId, testedAt: new Date().toISOString(),
    scope: 'local-ui-not-physical-device', testCount: 1, nativeCaseCount: 1,
    steps: [{ id: 'guardian-parent-ui', status: 'passed' }], checks: marker.checks,
    screenshots: marker.screenshots, transcriptSha256: createHash('sha256').update(transcript).digest('hex'),
    verificationId: id, status: 'revoked', revision: 8, auditEventCount: 8,
    managerDecisionMethod: 'authenticated-local-sdk-not-management-ui', physicalDevice: false, productionWrites: false,
    teamChatImplemented: false, childEmergencyImplemented: false,
    sourceFiles: Object.fromEntries(sources.map((path) => [path, createHash('sha256')
      .update(readFileSync(resolve(import.meta.dirname, '../..', path))).digest('hex')])) };
  writeFileSync(resolve(directory, 'guardian-parent-results.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}
