import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { call, denied, signIn } from './local-flow-client.mjs';
import { seedEmergencyNativeFixture, verifyEmergencyNativeFixture, cleanupEmergencyNativeFixture } from './local-emergency-native-fixture.mjs';

execFileSync(process.execPath, [resolve(import.meta.dirname, 'seed-firebase-emulator.mjs')],
  { env: process.env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
const fixture = await seedEmergencyNativeFixture(), checks = [];
let failure;
try {
  const parent = await signIn('p@example.test'), manager = await signIn('c@example.test');
  const target = { kind: 'child', childId: fixture.childId, clubId: fixture.clubId };
  const child = await call('getEmergencyContact', parent, { target });
  assert.equal(child.childInstanceId, fixture.childInstanceId); assert.equal(child.contact, null);
  checks.push({ id: 'actual-parent-request-and-independent-manager-verification', status: 'passed' });
  await call('saveEmergencyContact', parent, { target: { kind: 'self' }, expectedRevision: 0, requestId: randomUUID(),
    contact: { name: 'Contact adulte QA', phone: '+12025550123' } });
  await call('saveEmergencyContact', parent, { target, expectedRevision: 0, expectedChildInstanceId: child.childInstanceId,
    requestId: randomUUID(), contact: { name: 'Contact enfant QA', phone: '+12025550124' } });
  checks.push({ id: 'distinct-adult-and-immutable-child-contacts', status: 'passed' });
  const managerRevokeRequestId = randomUUID();
  await call('transitionGuardianVerification', manager, { childId: fixture.childId, clubId: fixture.clubId,
    parentUserId: parent.uid, action: 'revoke', expectedRevision: 2, requestId: managerRevokeRequestId });
  await denied('getEmergencyContact', parent, { target }, 'PERMISSION_DENIED');
  await call('saveEmergencyContact', parent, { target: { kind: 'self' }, expectedRevision: 1, requestId: randomUUID(), contact: null });
  checks.push({ id: 'revoked-parent-denied-and-own-contact-removal-unchanged', status: 'passed' });
  await verifyEmergencyNativeFixture(fixture, { managerRevokeRequestId });
  checks.push({ id: 'exact-three-operations-and-protected-state', status: 'passed' });
} catch (error) { failure = error; }
try { await cleanupEmergencyNativeFixture(fixture); }
catch (cleanup) { throw failure ? new AggregateError([failure, cleanup], 'Contact fixture and cleanup failed') : cleanup; }
if (failure) throw failure;
checks.push({ id: 'scoped-fixture-cleanup-restores-original-records-and-roles', status: 'passed' });
const files = ['scripts/qa/local-emergency-fixture-suite.mjs', 'scripts/qa/local-emergency-native-fixture.mjs',
  'functions/src/services/emergencyContactAuthority.ts', 'functions/src/services/emergencyContact.ts', 'functions/src/domain/emergencyContact.ts'];
writeFileSync(process.env.SGM_LOCAL_FLOW_OUTPUT, JSON.stringify({ scope: 'contact-fixture-services-not-native-handoff',
  projectId: 'demo-sgm-local-qa', runId: process.env.SGM_LOCAL_RUN_ID, testedAt: new Date().toISOString(), checks,
  verificationPreseeded: false, fixtureCleanupVerified: true, productionWrites: false, physicalDevice: false, nativeUiExecuted: false,
  sourceFiles: Object.fromEntries(files.map((file) => [file, createHash('sha256').update(readFileSync(resolve(import.meta.dirname, '../..', file))).digest('hex')]))
}, null, 2) + '\n', { flag: 'wx' });
console.log('Passed five real contact-fixture service checks, including independent verification and protected cleanup.');
