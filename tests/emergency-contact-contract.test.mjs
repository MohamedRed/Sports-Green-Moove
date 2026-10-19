import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('contact ownership and guardian authority are authenticated and checked in each transaction', () => {
  const callable = read('functions/src/callables/emergencyContact.ts');
  assert.equal(callable.split('requireAuth(request.auth?.uid)').length - 1, 2);
  const service = read('functions/src/services/emergencyContact.ts');
  assert.equal(service.split('await requireEmergencyContactAuthority(transaction, uid, token,').length - 1, 2);
  assert(service.indexOf('await requireEmergencyContactAuthority', service.indexOf('export async function writeEmergencyContact')) < service.indexOf('if (operation.exists)'));
  const authority = read('functions/src/services/emergencyContactAuthority.ts');
  for (const guard of ['hasRole(token, "child")', 'requireRole(token, "parent")', 'parsed.data.status !== "verified"',
    'parsed.data.parentUserId !== uid', 'parsed.data.clubId !== clubId', 'parsed.data.childId !== childId',
    'isGuardianOfChild(child.data(), uid)', 'isActiveGuardianClubMember(membership.data(), uid, clubId)', 'club.get("status") === "archived"'])
    assert(authority.includes(guard), guard);
});
test('contacts use private collections, revisioned removal and payload-bound operations without contact details', () => {
  const service = read('functions/src/services/emergencyContact.ts'), rules = read('firestore.rules');
  for (const collection of ['emergencyContacts', 'emergencyContactOperations'])
    assert(rules.includes(`match /${collection}/`));
  assert.match(rules, /match \/emergencyContacts\/\{contactId\} \{\s+allow read, write: if false;/);
  assert.match(rules, /match \/emergencyContactOperations\/\{operationId\} \{\s+allow read, write: if false;/);
  assert(service.includes('(current?.revision ?? 0) !== input.expectedRevision'));
  assert(service.includes('emergencyDigest([input.target, input.expectedRevision, input.contact,'));
  assert(service.includes('...(identity.childInstanceId ? [identity.childInstanceId] : [])'));
  assert.match(service, /transaction\.create\(operationRef, \{ actorUserId: uid, contactId, fingerprint, revision, createdAt: now \}\)/);
  assert.doesNotMatch(service, /transaction\.delete|console\.|logger\./);
});
test('contact code is modular and both service CI paths run the actual isolated scenarios', () => {
  for (const path of ['functions/src/domain/emergencyContact.ts', 'functions/src/services/emergencyContact.ts',
    'functions/src/services/emergencyContactAuthority.ts', 'functions/src/callables/emergencyContact.ts',
    'scripts/qa/local-emergency-contact-suite.mjs', 'scripts/qa/run-local-emergency-contact.mjs'])
    assert(read(path).split('\n').length < 300, path);
  for (const file of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + file).includes('npm run test:emergency-contact && node --test tests/emergency-contact-contract.test.mjs'));
  const suite = read('scripts/qa/local-emergency-contact-suite.mjs');
  assert.equal((suite.match(/await check\(/g) ?? []).length, 16);
  assert(suite.includes('physicalDevice: false, dialerOpened: false'));
});
test('retained original contact service proof cannot imply a native emergency action', () => {
  const raw = read('docs/release/evidence/local-emergency-contact-2026-10-18/services.json');
  assert.equal(createHash('sha256').update(raw).digest('hex'), '64e837db11ddd8743cc89263311fbad1dfa6cedf19c4cd2378ece897ba51ac17');
  const result = JSON.parse(raw);
  assert.equal(result.runId, '751957def42330a8e998c6cd6f7baf3a'); assert.equal(result.testCount, 16);
  assert.equal(result.checks.length, 16); assert(result.checks.every((item) => item.status === 'passed'));
  for (const key of ['productionWrites', 'physicalDevice', 'nativeUiExecuted', 'dialerOpened']) assert.equal(result[key], false);
  assert.equal(result.providerRequests, 0);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), result.sourceFiles);
  assert(!raw.includes('+12025550123')); assert(!raw.includes('Contact fictif QA'));
});
