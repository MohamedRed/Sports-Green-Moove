import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = 'docs/release/evidence/local-guardian-verification-2026-10-18/';

test('retained guardian service checks prove exact scope without completing child contacts or team chat', () => {
  assert.equal(createHash('sha256').update(read(base + 'services.json')).digest('hex'),
    '8fa675af9ea9f6b281c0cd07bdb76514fc375cce7aa0c13faae7dd0595fa1431');
  const result = JSON.parse(read(base + 'services.json'));
  assert.equal(result.projectId, 'demo-sgm-local-qa'); assert.match(result.runId, /^[a-f0-9]{32}$/);
  assert.equal(result.testedAt.slice(0, 10), '2026-10-18');
  assert.equal(result.checks.length, 20); assert.equal(result.testCount, 20);
  assert(result.checks.every((item) => item.status === 'passed'));
  assert.equal(new Set(result.checks.map((item) => item.id)).size, 20);
  for (const name of ['providerRequests', 'productionWrites', 'physicalDevice', 'teamChatImplemented', 'childEmergencyImplemented'])
    assert.equal(result[name], name === 'providerRequests' ? 0 : false);
  assert.equal(Object.keys(result.sourceFiles).length, 5);
  for (const [path, digest] of Object.entries(result.sourceFiles)) {
    assert.match(path, /^(functions\/src\/|firestore.rules$|scripts\/qa\/local-guardian-verification-suite.mjs$)/);
    assert.match(digest, /^[a-f0-9]{64}$/, path);
  }
  for (const id of ['parent-manager-cannot-self-verify', 'foreign-manager-denied', 'admin-alone-denied',
    'concurrent-manager-decisions-have-one-winner', 'old-success-replay-returns-current-revoked-state-with-no-new-write',
    'private-direct-access-and-immutable-audit-boundaries']) assert(result.checks.some((item) => item.id === id));
  assert.match(read(base + 'README.md'), /Nothing has been deployed to production/);
});

test('the service keeps parent requests separate from scoped manager decisions and writes only private verification records', () => {
  const callable = read('functions/src/callables/guardianVerification.ts');
  assert(callable.includes('requireAuth(request.auth?.uid)')); assert(callable.includes('parseCallableData(guardianTransitionSchema, request.data)'));
  const service = read('functions/src/services/guardianVerification.ts');
  assert(service.includes('requireRole(token, managerAction ? "clubManager" : "parent")'));
  assert(service.includes('managerAction ? uid === input.parentUserId : uid !== input.parentUserId'));
  assert(service.includes('isActiveClubManager(manager.data(), uid, input.clubId)'));
  assert(service.includes('firestore.runTransaction'));
  assert(service.includes('previousEvent.get("fingerprint") !== fingerprint'));
  assert(service.includes('current?.revision ?? 0'));
  assert(service.includes('transaction.create(event'));
  assert.doesNotMatch(service, /requireMembershipReviewer|hasRole\(.*admin|guardianUserIds:\s*|collection\("teams"\)|collection\("notifications"\)|\.delete\(/);
  const rules = read('firestore.rules');
  for (const collection of ['guardianVerifications', 'guardianVerificationEvents']) {
    const section = rules.split(`match /${collection}/`)[1].split('\n    }')[0];
    assert(section.includes('isSelf(resource.data.parentUserId) || isClubManager(resource.data.clubId)'));
    assert(section.includes('allow write: if false'));
  }
});

test('both CI paths rerun isolated authority and the private website retains incomplete native flows', () => {
  assert.equal(JSON.parse(read('package.json')).scripts['test:guardian-verification'], 'node scripts/qa/run-local-guardian-verification.mjs');
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml'])
    assert(read('.github/workflows/' + name).includes('run: npm run test:guardian-verification'));
  const smoke = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(smoke.split('"tests/guardian-verification-contract.test.mjs"').length - 1, 2);
  assert(smoke.includes('run: node --test tests/guardian-verification-contract.test.mjs'));
  assert.equal(content.flows.find((flow) => flow.id === 'clubs').status, 'partial');
  assert.equal(content.flows.find((flow) => flow.id === 'tracking').status, 'untested');
  assert(content.updates.some((entry) => entry.flow === 'clubs' && entry.title === 'La vérification des parents passe les essais locaux'));
  const group = content.blockers.find((entry) => entry.id === 'group-conversation');
  assert.equal(group.source, 'docs/release/evidence/local-guardian-parent-native-2026-10-18/README.md');
  assert.match(group.next, /inscriptions par équipe/);
});
