import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRetainedTeamConversation } from '../scripts/qa/team-conversation-retained-evidence.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('retained service proof preserves eighteen executed scenarios without app or notification acceptance', () => {
  const run = validateRetainedTeamConversation(process.cwd(), 'docs/release/evidence/team-conversation-services-2026-10-21/services.json');
  assert.equal(run.steps.length, 18); assert.equal(run.notificationsVerified, false);
});

test('team conversation access is transaction-bound and not added to legacy chat routing', () => {
  const authority = read('functions/src/services/teamConversationAuthority.ts');
  for (const marker of ['childLogin.exists', 'adultTeamChatAccount', 'readTeamEnrollment', 'teamEnrollmentEligibility',
    'guardianVerificationSchema', 'latestAdmission', 'earliestCurrentAdmission', 'context.teamInstanceId', '.limit(201)'])
    assert(authority.includes(marker), marker);
  const service = read('functions/src/services/teamConversation.ts');
  assert.equal(service.split('await requireTeamConversationAccess(transaction, uid, token, input)').length - 1, 2);
  assert(service.includes('.where("createdAt", ">", access.availableAfter)'));
  assert(service.includes('parseMembershipPageCursor(cursor, scope)'));
  assert(service.includes('transaction.create(operation'));
  assert(!read('functions/src/domain/chatReference.ts').includes('"team"'));
  assert(!service.includes('collection("messages")')); assert(!service.includes('collection("notifications")'));
});
test('isolated trial is included in smoke and cannot be presented as app or notification proof', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert(workflow.includes('npm run test:team-conversation'));
  assert(workflow.includes('tests/team-conversation-contract.test.mjs'));
  const trial = read('scripts/qa/local-team-conversation-suite.mjs');
  for (const marker of ['verified-parent-joins-approved-child-team-without-earlier-history',
    'guardian-revocation-denies-read-pagination-send-and-replay', 'child-club-rejoining-resets-parent-history',
    'second-independently-verified-parent-is-included-with-its-own-history-boundary',
    'recreated-team-cannot-inherit-old-enrollment-or-message-history', 'notificationsVerified: false',
    'nativeUiExecuted: false', 'protectedBaselinePreserved', 'await deleteApp(getApp())']) assert(trial.includes(marker), marker);
  const runner = read('scripts/qa/run-local-team-conversation.mjs');
  assert(runner.includes('runtime.cleanup()')); assert(runner.includes('assertLocalEndpointsClosed(ports)'));
  const rules = read('firestore.rules');
  for (const path of ['teamConversations/{document=**}', 'teamMessageOperations/{operationId}'])
    assert(rules.includes(`match /${path} {\n      allow read, write: if false;`));
  const indexes = JSON.parse(read('firestore.indexes.json'));
  assert(indexes.indexes.some(index => index.collectionGroup === 'teamEnrollments' &&
    index.fields.some(field => field.fieldPath === 'teamInstanceId') && index.fields.some(field => field.fieldPath === 'status')));
});
