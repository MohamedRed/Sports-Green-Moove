import assert from 'node:assert/strict';
import {teamPushRegistrationFingerprint, teamPushRegistrationRecordSchema} from '../../functions/lib/domain/teamPushRegistration.js';

export async function verifyTeamPushSignOutRecords(db, marker, {uid, runId}) {
  assert.equal(marker.scope, 'isolated-native-ui-signout-with-synthetic-phone-token');
  assert.equal(marker.projectId, 'demo-sgm-local-qa'); assert.equal(marker.runId, runId);
  assert.match(marker.installationHash, /^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(marker.activationRevision) && marker.activationRevision > 0);
  assert(Number.isSafeInteger(marker.removalRevision) && marker.removalRevision > marker.activationRevision);
  for (const key of ['confirmedWhileAuthenticated', 'authAbsentAfter', 'uiLoginReturned', 'durableSignOutIntent']) assert.equal(marker[key], true, key);
  assert.equal(marker.syntheticTokenCalls, 1); assert.equal(marker.realMessagingSdkCalls, 0); assert.equal(marker.pushDeliveryVerified, false);
  const registrations = db.collection('teamPushInstallations'), snapshot = await registrations.doc(marker.installationHash).get();
  assert.equal(snapshot.exists, true); const record = teamPushRegistrationRecordSchema.parse(snapshot.data());
  assert.equal(record.schemaVersion, 1); assert.equal(record.userId, uid); assert.equal(record.platform, 'android');
  assert.equal(record.active, false); assert.equal(record.token, null); assert.equal(record.revision, marker.removalRevision);
  assert.equal(record.fingerprint, teamPushRegistrationFingerprint(uid, {platform: 'android', revision: marker.removalRevision, token: null}));
  assert.match(record.secretHash, /^[a-f0-9]{64}$/);
  assert(record.updatedAt.toMillis() >= record.createdAt.toMillis());
  assert.equal((await registrations.get()).size, 1);
  assert.equal((await db.collection('teamPushTokens').get()).size, 0);
  return {scope: 'independent-local-removal-state-not-real-token-delivery', finalRemovalIndependentlyRead: true,
    activationIndependentlyRead: false, inactiveRegistrations: 1, tokenIndexes: 0, realMessagingSdkCalls: 0, pushDeliveryVerified: false};
}
