import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { emergencyPhonePhases, verifyEmergencyPhoneCheckpoint } from './manual-emergency-checkpoints.mjs';

const [sessionPath, output] = process.argv.slice(2);
assert(isAbsolute(sessionPath ?? '') && isAbsolute(output ?? ''));
assert.equal(statSync(sessionPath).mode & 0o077, 0, 'Fixture credentials must remain private');
const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
assert.equal(session.projectId, 'demo-sgm-local-qa'); assert.match(session.runId, /^[a-f0-9]{32}$/);
process.env.SGM_QA_PASSWORD = session.password;
const { db, signIn, call } = await import('./local-flow-client.mjs');
const { seedEmergencyNativeFixture, verifyEmergencyNativeFixture, cleanupEmergencyNativeFixture } =
  await import('./local-emergency-native-fixture.mjs');
mkdirSync(output, { mode: 0o700 });
const sources = ['scripts/qa/manual-emergency-session.mjs', 'scripts/qa/manual-emergency-checkpoints.mjs',
  'scripts/qa/local-emergency-native-fixture.mjs', 'functions/src/domain/emergencyContact.ts',
  'functions/src/services/emergencyContact.ts', 'functions/src/services/emergencyContactAuthority.ts',
  ...['data/EmergencyContactModels', 'services/EmergencyContactWire', 'services/FirebaseAndroidEmergencyContactGateway',
    'services/AndroidEmergencyDialer', 'ui/EmergencyContactState', 'ui/EmergencyContactScreen', 'ui/EmergencyContactRoute']
    .map((file) => 'android/app/src/main/java/be/sportgreenmoove/app/' + file + '.kt')];
const sourceFiles = Object.fromEntries(sources.map((file) => [file,
  createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]));
const fixture = await seedEmergencyNativeFixture(), checkpoints = [];
let completed = false, failure, managerRevokeRequestId;
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Isolated emergency fixture ready. Enter the observed checkpoint, revoke-parent, finish, or stop.');
try {
  for await (const command of input) {
    const phase = command.trim(); if (phase === 'stop') break;
    if (phase === 'finish') {
      assert.equal(checkpoints.length, emergencyPhonePhases.length);
      await verifyEmergencyNativeFixture(fixture, { managerRevokeRequestId }); completed = true; break;
    }
    if (phase === 'revoke-parent') {
      assert.equal(checkpoints.length, 4); assert.equal(managerRevokeRequestId, undefined);
      managerRevokeRequestId = randomUUID();
      await call('transitionGuardianVerification', await signIn('c@example.test'), { childId: fixture.childId,
        clubId: fixture.clubId, parentUserId: 'sgm-qa-parent', action: 'revoke', expectedRevision: 2,
        requestId: managerRevokeRequestId });
      console.log('Separate manager service revocation committed; this is not manager UI evidence.'); continue;
    }
    assert.equal(phase, emergencyPhonePhases[checkpoints.length], 'Checkpoints must execute once in order');
    const rows = async (name) => (await db.collection(name).get()).docs.map((row) => ({ id: row.id, ...row.data() }));
    const state = { contacts: await rows('emergencyContacts'), operations: await rows('emergencyContactOperations'),
      guardian: (await db.collection('guardianVerifications').doc(fixture.verificationId).get()).data() };
    const result = verifyEmergencyPhoneCheckpoint(phase, state, fixture);
    writeFileSync(resolve(output, phase + '.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
      recordedAt: new Date().toISOString(), scope: 'independent-emergency-checkpoint-not-ui-or-dialer-proof',
      ...result, childInstanceId: fixture.childInstanceId }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    checkpoints.push(result); console.log(`Persisted checkpoint passed: ${phase}`);
  }
} catch (error) { failure = error; }
finally { input.close(); }
try { await cleanupEmergencyNativeFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'Contact session and cleanup failed') : cleanup; }
writeFileSync(resolve(output, 'session-results.json'), JSON.stringify({ projectId: session.projectId, runId: session.runId,
  testedAt: new Date().toISOString(), scope: 'manual-emergency-persisted-checkpoints-not-ui-or-release-proof',
  completed: completed && !failure, checkpoints, sourceFiles, fixtureCleanupVerified: true,
  managerDecisionMethod: 'authenticated-local-sdk-request-verify-revoke', verificationPreseeded: false,
  productionWrites: false, physicalUiProvenByThisReport: false, dialerHandoffProvenByThisReport: false,
  childOwnAccountDialImplemented: false }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
if (failure) throw failure;
console.log(`Contact session closed: ${completed ? 'all checkpoints passed' : 'incomplete'}. Fixture cleanup verified.`);
