import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-team-ownership-2026-10-16/';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const report = (name) => JSON.parse(read(base + name));
const teamCases = (value) => {
  const suite = value.testResults.find((item) => item.name.endsWith('/tests/team-ownership-rules.test.ts'));
  assert(suite); assert.equal(suite.assertionResults.length, 14);
  return suite.assertionResults;
};
test('original reports reproduce four unauthorized successful writes and pass the unchanged team cases after the fix', () => {
  const before = report('rules-before.json'), after = report('rules-after.json');
  assert.equal(before.numTotalTests, 14); assert.equal(before.numFailedTests, 4); assert.equal(before.numPassedTests, 10);
  assert.equal(before.success, false); assert.equal(after.success, true);
  assert.equal(after.numTotalTests, 27); assert.equal(after.numFailedTests, 0); assert.equal(after.numPassedTests, 27);
  const red = teamCases(before), green = teamCases(after);
  assert.deepEqual(red.map((item) => item.fullName).sort(), green.map((item) => item.fullName).sort());
  assert(green.every((item) => item.status === 'passed'));
  const failed = red.filter((item) => item.status === 'failed');
  assert.equal(failed.length, 4);
  assert.equal(failed.filter((item) => item.fullName.includes('foreign manager takeover')).length, 3);
  assert.equal(failed.filter((item) => item.fullName.includes('manager of both clubs')).length, 1);
  for (const item of failed) assert(item.failureMessages.every((message) => message.includes('Expected request to fail, but it succeeded.')));
  for (const value of [before, after]) assert.equal(new Date(value.startTime).toISOString().slice(0, 10), '2026-10-16');
  const full = report('full-rules.json');
  assert.equal(full.numTotalTests, 40); assert.equal(full.numPassedTests, 40); assert.equal(full.numFailedTests, 0);
  assert.equal(full.success, true); assert.equal(full.testResults.length, 5);
  assert(teamCases(full).every((item) => item.status === 'passed'));
});
test('signed-in transport evidence retains all earlier groups and requires exact denials plus unchanged saved teams', () => {
  const run = report('services.json');
  assert.equal(run.runId, 'a6a896d95309b5fa78e559296b41a65a'); assert.equal(run.testedAt, '2026-10-16T14:11:25.194Z');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(run.steps.length, 19); assert(run.steps.every((step) => step.status === 'passed'));
  assert(run.steps.some((step) => step.id === 'team-ownership'));
  const ownership = run.teamOwnership;
  assert.equal(ownership.method, 'authenticated-local-firestore-rest-with-independent-persisted-checks');
  assert.equal(ownership.deniedMutations, 10); assert.equal(ownership.attempts.length, 10);
  assert(ownership.attempts.every((attempt) => attempt.status === 403 && attempt.unchanged === true));
  for (const key of ['foreignTeamUnchanged', 'scopedNameEditAllowed', 'twoClubReassignmentDenied', 'disabledManagerDenied'])
    assert.equal(ownership[key], true);
  assert.equal(ownership.nativeUi, false); assert.equal(ownership.productionDeployed, false);
  assert(ownership.limits.some((limit) => limit.includes('no team assignment, guardian enrollment or team conversation')));
  assert.equal(run.chatResponseLoss.duplicateMessages, 0); assert.equal(run.membershipReview.auditCount, 3);
  assert.equal(run.tripCapacity.seatsAfterCancellation, 4);
});
test('the boundary is registered in both CI paths and does not promote group or phone readiness', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.scripts['test:rules'].includes('tests/team-ownership-rules.test.ts'));
  assert(pkg.scripts['test:team-ownership-rules'].includes('tests/team-ownership-rules.test.ts'));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/team-ownership-rules.test.ts"').length - 1, 2);
  assert.equal(workflow.split('"tests/team-ownership-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: npm run test:team-ownership-rules'));
  assert.match(workflow, /^\s+run: node --test[^\n]*\btests\/team-ownership-evidence\.test\.mjs(?:\s|$)/m);
  assert.match(read('scripts/qa/local-flow-suite.mjs'), /check\('team-ownership'/);
  assert.match(read('scripts/qa/run-local-flows.mjs'), /result.teamOwnership\?\.deniedMutations, 10/);
  const clubs = content.flows.find((flow) => flow.id === 'clubs'), messages = content.flows.find((flow) => flow.id === 'messages');
  assert.equal(clubs.status, 'partial'); assert.equal(clubs.local.source, base + 'services.json');
  assert(clubs.local.groups.includes('team-ownership')); assert.equal(clubs.local.checkedAt, '2026-10-16');
  assert.equal(clubs.source, 'docs/release/evidence/local-guardian-parent-native-2026-10-18/README.md');
  assert.match(read(clubs.source), /local-team-ownership-2026-10-16\/README.md/);
  assert.equal(clubs.ui.source, 'docs/release/evidence/local-guardian-parent-native-2026-10-18/guardian-parent-results.json');
  assert.equal(messages.status, 'partial'); assert.match(messages.remaining, /groupes/);
  assert.match(clubs.remaining, /enfants/); assert.match(clubs.remaining, /téléphone/);
  assert.match(read(base + 'README.md'), /not been deployed to production/);
  assert.match(read(base + 'README.md'), /not proof that a team ID cannot be deleted and\nrecreated/);
});

test('the manager approval policy remains authoritative without accepting a connected team-chat result', () => {
  const contract = read('docs/contracts/team-conversations.md');
  assert.match(contract, /owner selected the club manager to approve people and children/);
  assert.match(contract, /team's stored club, not a client-supplied club ID/);
  assert.match(contract, /administrator\nrole alone does not grant/);
  assert.match(contract, /club manager to\nverify parent-child authorisation as a separate decision from team enrollment/);
  assert.match(contract, /parents cannot approve\ntheir own relationship/);
  assert.match(contract, /client-declared `children.guardianUserIds` array does not establish\nthis verification/);
  assert.match(contract, /connected team chat app flow remains unverified/);
  assert.match(contract, /No connected team-conversation app result is accepted/);
  assert(!contract.includes('Approval Policy Pending'));
  const group = content.blockers.find((item) => item.id === 'group-conversation');
  assert.match(group.next, /échange entre deux comptes/); assert(!group.next.includes('Choisir qui'));
  assert.equal(group.source, 'docs/release/evidence/team-chat-components-2026-10-21/README.md');
  assert(content.updates.some((item) => item.title === 'Le club validera les inscriptions aux équipes' && item.date === '2026-10-17'));
});

test('personal contacts preserve verified-parent authority without accepting child-account or physical handoff', () => {
  const contract = read('docs/contracts/emergency-contact.md');
  assert.match(contract, /Adults\nmanage their own contact; a child's verified parent chooses the child's contact/);
  assert.match(contract, /manager's verification role does not give them permission to\nchoose or edit/);
  assert.match(contract, /current `guardianUserIds` link is not evidence of manager verification/);
  assert.match(contract, /not a complete implementation/);
  assert.match(contract, /Android editor source is now wired/);
  assert.match(contract, /execution still pending/);
  assert.match(contract, /Do not invent a number, substitute emergency services, or place a call\nautomatically/);
  const emergency = content.blockers.find((item) => item.id === 'emergency-contact');
  assert.match(emergency.next, /Terminer l’accès de l’enfant/);
  assert.match(emergency.next, /sur téléphone/);
  assert.match(emergency.text, /Conducteur et parent.*depuis un trajet en local/);
  assert.equal(emergency.source, content.nativeVerification.source);
  assert.match(emergency.next, /sans appeler/);
  assert.doesNotMatch(emergency.next, /Choisir le contact/);
});
