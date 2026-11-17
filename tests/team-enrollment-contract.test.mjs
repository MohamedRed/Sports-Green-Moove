import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content } from '../partner-portal/content.mjs';
import { assertOriginalPaginationSources } from './helpers/original-pagination-sources.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const text = (path) => read(path).toString('utf8');
const base = 'docs/release/evidence/local-team-enrollment-2026-10-18/';
test('retained enrollment proof binds its original source snapshot without accepting team chat or native screens', () => {
  const report = JSON.parse(text(base + 'services.json'));
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-18');
  assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.coverage, 'team-enrollment-authority-not-conversation-or-native-ui');
  assert.equal(report.testCount, 20); assert.equal(report.checks.length, 20);
  assert.deepEqual(report.steps, report.checks); assert(report.checks.every((item) => item.status === 'passed'));
  assert.equal(new Set(report.checks.map((item) => item.id)).size, 20);
  for (const flag of ['teamChatImplemented', 'nativeUiExecuted', 'productionWrites', 'physicalDevice']) assert.equal(report[flag], false);
  assert.equal(report.providerRequests, 0); assert.equal(report.paginationFixtureRows, 21);
  assert.equal(Object.keys(report.sourceFiles).length, 10);
  assertOriginalPaginationSources(report.sourceFiles, ['functions/src/callables/teamEnrollment.ts']);
  const flow = content.flows.find((item) => item.id === 'team-enrollment');
  assert.equal(flow.status, 'partial'); assert.equal(flow.images.length, 20);
  assert.equal(flow.ui.source, 'docs/release/evidence/local-team-enrollment-native-2026-10-19/team-enrollment-results.json');
  assert.equal(flow.local.source, 'docs/release/evidence/team-club-identity-2026-10-19/passed/results.json'); assert.match(flow.remaining, /autres appareils/);
  assert.equal(content.flows.find((item) => item.id === 'messages').status, 'partial');
});
test('enrollment identity and authority stay server owned and transaction fenced', () => {
  const authority = text('functions/src/services/teamEnrollmentAuthority.ts');
  for (const guard of ['snapshot.createTime', 'child.createTime', 'isActiveClubManager', 'isActiveGuardianClubMember',
    'guardianVerificationId(context.clubId, childId, uid)', 'record.lastActorUserId !== uid',
    'timestampAtOrAfter(record.updatedAt, created)', 'timestampAtOrAfter(record.updatedAt, club.createTime)',
    '["public", "private"]', 'readTeamEnrollment']) assert(authority.includes(guard), guard);
  assert(text('functions/src/domain/teamEnrollment.ts').includes('value.nanoseconds >= minimum.nanoseconds'));
  const service = text('functions/src/services/teamEnrollment.ts');
  assert.equal((service.match(/firestore.runTransaction/g) ?? []).length, 2);
  for (const guard of ['id !== input.expectedEnrollmentId', 'team.teamInstanceId !== input.expectedTeamInstanceId',
    'current?.revision ?? 0', 'teamEnrollmentOperationId(uid, input.requestId)', 'current.requesterUserId !== uid',
    'team.teamInstanceId !== current.teamInstanceId']) assert(service.includes(guard), guard);
  assert(!service.includes('setCustomUserClaims')); assert(!service.includes('notifications'));
  const page = text('functions/src/services/teamEnrollmentViews.ts');
  assert(page.includes('query.limit(21)')); assert(page.includes('page.docs.slice(0, 20)'));
  assert(page.includes('[uid, "team-enrollment-review", context.teamInstanceId]'));
  const callables = text('functions/src/callables/teamEnrollment.ts');
  for (const name of ['getTeamEnrollmentView', 'requestTeamEnrollment', 'transitionTeamEnrollment', 'listTeamEnrollments']) {
    assert(callables.includes(`export const ${name}`)); assert(text('functions/src/index.ts').includes(name));
  }
  assert.equal((callables.match(/requireAuth\(request.auth\?\.uid\)/g) ?? []).length, 4);
});
test('new enrollment modules remain modular and run in backend and web smoke gates', () => {
  const report = JSON.parse(text(base + 'services.json'));
  for (const path of Object.keys(report.sourceFiles).filter((path) => /\.(ts|mjs)$/.test(path)))
    assert(text(path).split('\n').length < 300, path);
  const pkg = JSON.parse(text('package.json'));
  assert.equal(pkg.scripts['test:team-enrollment'], 'node scripts/qa/run-local-team-enrollment.mjs');
  for (const path of ['.github/workflows/backend-ci.yml', '.github/workflows/web-integration-smoke.yml']) {
    const source = text(path); assert(source.includes('npm run test:team-enrollment'));
    assert(source.includes('tests/team-enrollment-contract.test.mjs'));
  }
});
