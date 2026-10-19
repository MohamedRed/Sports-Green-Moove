import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const sha = (raw) => createHash('sha256').update(raw).digest('hex');
const base = 'docs/release/evidence/membership-cursor-2026-10-18/';
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString('base64');
const tokenUrl = moduleUrl(text('admin/src/membershipPageToken.ts'));
const { membershipCursorMaxLength, membershipPageToken } = await import(tokenUrl);
const { guardianPage, guardianClub } = await import(moduleUrl(text('admin/src/guardianReviewWire.ts')
  .replace('"./membershipPageToken"', JSON.stringify(tokenUrl))));

test('browser consumers retain a long opaque token and reject invalid values without treating them as end-of-list', () => {
  assert.equal(membershipCursorMaxLength, 16_384); const value = 'A'.repeat(membershipCursorMaxLength);
  assert.equal(membershipPageToken(value), value); assert.equal(membershipPageToken(null), null);
  const page = guardianPage({ items: [{ id: '界'.repeat(256), name: 'Club QA' }], nextCursor: value }, guardianClub);
  assert.equal(page.nextCursor, value); assert.equal(page.items[0].id.length, 256);
  for (const token of ['', undefined, 3, {}, 'A'.repeat(16_385), 'ab=', 'a/b', 'ab+c', 'a\n', 'é'])
    assert.throws(() => membershipPageToken(token));
});
test('the unchanged six-case reproduction has five original failures and six current passes', () => {
  const before = json(base + 'unit-before.json'), after = json(base + 'unit-after.json');
  assert.equal(before.numTotalTests, 6); assert.equal(before.numFailedTests, 5); assert.equal(before.numPassedTests, 1);
  assert.equal(after.numTotalTests, 6); assert.equal(after.numFailedTests, 0); assert.equal(after.numPassedTests, 6);
  const cases = (run) => run.testResults.flatMap((suite) => suite.assertionResults).map((item) => item.fullName).sort();
  assert.deepEqual(cases(before), cases(after)); assert.equal(before.success, false); assert.equal(after.success, true);
});
test('eight actual authenticated groups cover all shared-cursor directories and one real local membership approval', () => {
  const report = json(base + 'services-verified.json'); assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.testCount, 8); assert.equal(report.steps.length, 8); assert(report.steps.every((item) => item.status === 'passed'));
  assert.equal(report.pages.length, 8); assert(report.pages.every((page) => page.firstCount === 20 && page.duplicateRows === 0));
  assert.equal(new Set(report.pages.map((page) => page.callable)).size, 8);
  assert(report.pages.slice(0, 4).every((page) => page.cursorLength > 2048 && page.cursorLength <= 16_384));
  assert.equal(report.actualLocalMembershipApprovals, 1); assert.equal(report.syntheticClubs, 21);
  assert.equal(report.syntheticRequestedGuardianRows, 21); assert.equal(report.syntheticTeamEnrollmentRows, 21);
  for (const key of ['nativeUiExecuted', 'productionWrites', 'livePushProven']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
});
test('four Android decoder cases are actual local unit passes, not native or SDK-connected phone evidence', () => {
  const report = json(base + 'decoder-checks.json'); assert.equal(report.unitCaseCount, 4);
  assert.equal(report.nativeUiExecuted, false); assert.equal(report.sdkConnectedContinuationProven, false);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(text(base + 'android-token-unit-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 4);
  for (const field of ['errors', 'failures', 'skipped']) assert.equal(Number(suite['@_' + field]), 0);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), report.sourceFiles);
  for (const [path, hash] of Object.entries(report.artifacts)) assert.equal(sha(read(base + path)), hash, path);
});
test('every affected server input uses the shared bounded schema while browser and Android consumers agree', () => {
  const callers = ['functions/src/callables/membershipLists.ts', 'functions/src/callables/guardianLists.ts',
    'functions/src/callables/guardianParent.ts', 'functions/src/callables/teamEnrollment.ts', 'functions/src/services/teamEnrollmentOptions.ts'];
  for (const path of callers) { assert(text(path).includes('membershipCursorSchema.optional()'), path); assert(!/max\((1600|2048)\)/.test(text(path)), path); }
  assert(text('functions/src/lib/membershipPageCursor.ts').includes('MEMBERSHIP_CURSOR_MAX_LENGTH = 16_384'));
  assert(text('android/app/src/main/java/be/sportgreenmoove/app/services/MembershipPageToken.kt').includes('MAX_LENGTH = 16_384'));
  assert(text('admin/src/membershipReviewGateway.ts').includes('membershipPageToken(data.nextCursor)'));
  assert(text('admin/src/guardianReviewWire.ts').includes('membershipPageToken(data.nextCursor)'));
  const review = text('functions/src/callables/membershipReview.ts');
  assert(review.includes('membershipId: firestoreDocumentIdSchema')); assert(review.includes('snapshot.id !== membershipDocumentId(member.userId, member.clubId)'));
  for (const workflow of ['backend-ci.yml', 'web-integration-smoke.yml']) assert(text('.github/workflows/' + workflow).includes('npm run test:membership-cursors'));
});
