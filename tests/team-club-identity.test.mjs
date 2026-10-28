import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateRetainedTeamClubIdentity, validateTeamClubIdentity, teamClubIdentityGroups } from '../scripts/qa/team-club-identity-evidence.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { content } from '../partner-portal/content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'docs/release/evidence/team-club-identity-2026-10-19/';
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const json = (file) => JSON.parse(read(base + file));
test('the CI fixture failure remains failed while eight service and ten actual browser checks bind the corrected sources', () => {
  const path = 'docs/release/evidence/team-review-club-order-2026-10-19/';
  for (const [file, hash] of Object.entries(JSON.parse(read(path + 'artifact-sha256.json'))))
    assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path + file, import.meta.url))).digest('hex'), hash, file);
  const before = JSON.parse(read(path + 'before-ci.json')); assert.equal(before.conclusion, 'failure');
  assert.equal(before.databaseId, 39330318532); assert.equal(before.headSha, '2f0753f39cc0f4f7d60580e52a4676e23ea9e034');
  assert(read(path + 'before-ci.txt').includes('0 !== 20'));
  const passed = JSON.parse(read(path + 'passed.json'));
  assert.equal(passed.testCount, 8); assert(passed.checks.every((item) => item.status === 'passed'));
  assert.equal(passed.browser.checks.length, 10); assert(passed.browser.checks.every((item) => item.status === 'passed'));
  assert.equal(passed.fixtureCleanupVerified, true); assert.equal(passed.productionWrites, false);
  assert.equal(passed.physicalDevice, false); assert.equal(passed.providerRequests, 0); assert.equal(passed.browser.externalRequests, 0);
  assertRetainedSourceFiles(root, passed.sourceFiles);
});
test('manager review fixtures create their club before sibling teams and restore siblings before the core baseline', () => {
  const fixture = read('scripts/qa/local-team-review-fixture.mjs');
  assert(fixture.indexOf('created.core = await seedTeamNativeFixture()') < fixture.indexOf("db.collection('teams').doc("));
  assert(fixture.indexOf('created.core.seeded = await teamNativeProtectedState()') < fixture.indexOf('for (const uid of created.users)'));
  const cleanup = fixture.slice(fixture.indexOf('export async function cleanupTeamReviewFixture'));
  assert(cleanup.indexOf('await extra.commit()') < cleanup.indexOf('await cleanupTeamNativeFixture'));
  assert(cleanup.indexOf('await auth.deleteUser(uid)') < cleanup.indexOf('await cleanupTeamNativeFixture'));
  assert(!fixture.includes('created.core.before ='));
});
test('the original five failed authorization groups remain failed and separate from setup and later passing trials', () => {
  const before = json('before/attempt.json');
  assert.equal(before.runId, 'fc686f70025e238a94af092317b06a09'); assert.equal(before.testCount, 8);
  assert.equal(before.checks.filter((step) => step.status === 'failed').length, 5);
  assert.deepEqual(before.observed, { clubCreationChanged: true, oldAdultEligible: true, oldGuardianAccepted: true, oldTeamOffered: true });
  assert.equal(before.baselineRecordsPreserved, true); assert.equal(before.claimsUnchanged, true);
  assert.equal(json('before/disposal.json').trialPassed, false);
  assert.equal(json('before/disposal.json').isolatedEnvironmentDestroyed, true);
  assertRetainedSourceFiles(root, before.sourceFiles);
  const first = json('initial-fix/results.json'); assert.equal(first.testCount, 8);
  assert(first.steps.every((step) => step.status === 'passed')); assertRetainedSourceFiles(root, first.sourceFiles);
  assert.throws(() => validateTeamClubIdentity(first)); assert.throws(() => validateTeamClubIdentity(before));
  assert(read(base + 'setup-not-executed/transcript.txt').includes('Java version before 21'));
  assert.equal(json('setup-not-executed/disposal.json').trialPassed, false);
});
test('ten actual authenticated identity checks bind source, baseline isolation, and full owned-runtime disposal', () => {
  const report = validateRetainedTeamClubIdentity(root, base + 'passed/results.json');
  assert.equal(report.runId, '35aa7b7053653b5c43210400a660cb88');
  assert.equal(report.testedAt.slice(0, 10), '2026-10-19');
  for (const [file, count] of [['team-enrollment', 20], ['team-options', 12]]) {
    const regression = json('regressions/' + file + '.json');
    assert.equal(regression.testCount, count); assert(regression.steps.every((step) => step.status === 'passed'));
    assert.equal(regression.teamChatImplemented, false); assertRetainedSourceFiles(root, regression.sourceFiles);
    assert(read(base + 'regressions/' + file + '.txt').includes('Script exited successfully (code 0)'));
  }
  assert.match(read(base + 'regressions/functions-tests.txt'), /364 passed/);
});
test('incomplete proofs, inherited access and stronger chat, native or physical claims cannot be accepted', () => {
  const original = json('passed/results.json');
  for (const change of [
    (r) => { r.observed.oldAdultEligible = true; }, (r) => { r.observed.oldGuardianAccepted = true; },
    (r) => { r.observed.oldTeamOffered = true; }, (r) => { r.teamChatImplemented = true; },
    (r) => { r.nativeUiExecuted = true; }, (r) => { r.physicalDevice = true; },
    (r) => { r.productionWrites = true; }, (r) => { r.baselineRecordsPreserved = false; },
    (r) => { r.claimsUnchanged = false; }, (r) => { r.isolatedEnvironmentDestroyed = false; },
    (r) => { r.emulatorEndpoints.closed = false; }, (r) => { r.steps.pop(); },
    (r) => { r.steps[0].status = 'failed'; }, (r) => { r.baselineCollections.pop(); },
  ]) { const value = structuredClone(original); change(value); assert.throws(() => validateTeamClubIdentity(value)); }
});
test('current team access and cursors use server club identity while the portal preserves original phone evidence', () => {
  for (const file of ['Authority', 'Options', 'Review', 'Views', '']) {
    const source = read('functions/src/services/teamEnrollment' + file + '.ts');
    assert(source.includes('teamBelongsToCurrentClub'), file);
  }
  assert(read('functions/src/services/teamEnrollmentAuthority.ts').includes('timestampAtOrAfter(record.updatedAt, club.createTime)'));
  for (const file of ['Options', 'Review']) assert(read('functions/src/services/teamEnrollment' + file + '.ts').includes('createTime.nanoseconds'));
  for (const file of ['.github/workflows/native-ci.yml', '.github/workflows/web-integration-smoke.yml'])
    assert(read(file).includes('tests/team-club-identity.test.mjs'));
  const flow = content.flows.find((row) => row.id === 'team-enrollment');
  assert.equal(flow.status, 'partial'); assert.equal(flow.local.source, base + 'passed/results.json');
  assert.equal(flow.local.checkedAt, '2026-10-19'); assert.deepEqual(flow.local.groups, teamClubIdentityGroups);
  assert.equal(flow.images.length, 15); assert.equal(flow.tour.length, 15);
  assert.match(flow.ui.source, /local-team-enrollment-native-2026-10-19/);
  assert.match(flow.phone.source, /phone-team-enrollment-2026-10-19/);
  assert.match(flow.remaining, /fermeture complète/);
  assert.doesNotMatch(flow.remaining, /Ajouter la conversation/);
  assert.equal(content.flows.find(row => row.id === 'team-conversation').status, 'partial');
});
