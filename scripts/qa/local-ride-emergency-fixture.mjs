import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, db, signIn } from './local-flow-client.mjs';
import { verifyRideEmergencyStoredState } from './verify-ride-emergency-ui.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const checks = [];
for (const [email, name, phone] of [['d@example.test', 'Contact conducteur QA', '+12025550125'],
  ['p@example.test', 'Contact parent QA', '+12025550126']]) {
  const actor = await signIn(email), input = { target: { kind: 'self' }, requestId: randomUUID(), expectedRevision: 0,
    contact: { name, phone } };
  const before = await call('getEmergencyContact', actor, { target: input.target });
  assert.equal(before.contact, null); assert.equal(before.revision, 0);
  await call('saveEmergencyContact', actor, input);
  const saved = await call('getEmergencyContact', actor, { target: input.target });
  assert.deepEqual(saved.contact, input.contact); assert.equal(saved.revision, 1);
  await call('saveEmergencyContact', actor, { ...input, requestId: randomUUID(), expectedRevision: 1, contact: null });
}
assert.deepEqual(await verifyRideEmergencyStoredState(), { contactCount: 2, operationCount: 4, contactValuesRemoved: true });
checks.push({ id: 'two-actual-actors-produce-exact-private-removal-state', status: 'passed' });
const operations = (await db.collection('emergencyContactOperations').get()).docs;
const original = operations[0].data();
for (const [id, patch] of [['foreign-actor-refused', { actorUserId: 'foreign-qa-account' }],
  ['private-contact-payload-refused', { contact: { name: 'Synthetic private field', phone: '+12025550125' } }]]) {
  try {
    await operations[0].ref.set({ ...original, ...patch });
    await assert.rejects(verifyRideEmergencyStoredState);
    checks.push({ id, status: 'passed' });
  } finally { await operations[0].ref.set(original); }
}
const duplicate = db.collection('emergencyContactOperations').doc('a'.repeat(64)); assert(!(await duplicate.get()).exists);
try {
  await duplicate.create(original); await assert.rejects(verifyRideEmergencyStoredState);
  checks.push({ id: 'unexpected-extra-operation-refused', status: 'passed' });
} finally { await duplicate.delete(); }
await verifyRideEmergencyStoredState();
checks.push({ id: 'original-state-restored-after-negative-verifier-cases', status: 'passed' });
const files = ['scripts/qa/local-ride-emergency-fixture.mjs', 'scripts/qa/verify-ride-emergency-ui.mjs',
  'functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContact.ts'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ scope: 'actual-contact-storage-verifier-not-native-ride-or-dialer',
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), checks,
  actualActors: 2, privateOperationsVerified: 4, nativeUiExecuted: false, physicalDevice: false,
  dialerOpened: false, rideJourneyExecuted: false, productionWrites: false, providerRequests: 0,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
console.log('Five actual isolated contact-storage verifier groups passed; no native ride, dialer or phone outcome accepted.');
