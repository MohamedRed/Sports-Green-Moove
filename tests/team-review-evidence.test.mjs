import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateTeamReviewReport, teamReviewCaptures } from '../scripts/qa/team-review-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { validateUiScope } from '../partner-portal/validate.mjs';
import { assertRetainedSourceFiles } from '../scripts/qa/retained-source-evidence.mjs';
import { fileURLToPath } from 'node:url';

const base = 'docs/release/evidence/local-team-review-2026-10-18/';
const bytes = (path) => readFileSync(new URL('../' + path, import.meta.url));
const read = (path) => bytes(path).toString('utf8');
const report = () => JSON.parse(read(base + 'results.json'));
test('actual management proof binds eight service groups, ten browser groups and eleven original artifacts', () => {
  const run = report(); validateTeamReviewReport(run);
  const hashes = JSON.parse(read(base + 'artifact-sha256.json')); assert.equal(Object.keys(hashes).length, 11);
  for (const [path, expected] of Object.entries(hashes)) assert.equal(createHash('sha256').update(bytes(base + path)).digest('hex'), expected, path);
  for (const path of teamReviewCaptures) {
    const png = bytes(base + path); assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const expectedWidth = Number(/-(\d+)\.png$/.exec(path)[1]);
    assert.equal(png.readUInt32BE(16), expectedWidth); assert.equal(png.readUInt32BE(20), 1100);
  }
  assert.equal(Object.keys(run.sourceFiles).length, 30);
  assertRetainedSourceFiles(fileURLToPath(new URL('../', import.meta.url)), run.sourceFiles);
  for (const path of Object.keys(run.sourceFiles)) assert(read(path).split('\n').length < 300, path);
  assert.doesNotMatch(read(base + 'results.json'), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
});
test('missing steps, cleanup, authority, browser work or stronger release claims never satisfy management proof', () => {
  for (const patch of [{ projectId: 'production' }, { fixtureCleanupVerified: false }, { checks: report().checks.slice(1) },
    { physicalDevice: true }, { releaseEvidenceAccepted: true }, { parentNativeUiProven: true }, { wholeNativeReplayProven: true },
    { managerDecisionsMethod: 'authenticated-local-sdk' }, { managerUiProven: false }, { providerRequests: 1 }, { browser: undefined }])
    assert.throws(() => validateTeamReviewReport({ ...report(), ...patch }));
  for (const patch of [{ externalRequests: 1 }, { checks: report().browser.checks.slice(1) }, { screenshots: [] }, { viewports: [1440] }])
    assert.throws(() => validateTeamReviewReport({ ...report(), browser: { ...report().browser, ...patch } }));
});
test('both manager-capable entries and the transport preserve session and club scope without an administrator bypass', () => {
  assert(read('admin/src/ClubDashboard.tsx').includes('<TeamReviewPanel uid={uid} />'));
  assert(read('admin/src/AdminDashboard.tsx').includes('canReviewClubRequests && <TeamReviewPanel uid={uid} />'));
  const gateway = read('admin/src/teamReviewGateway.ts'); assert.equal(gateway.split('currentUser?.uid !== uid').length - 1, 2);
  assert(gateway.includes('listTeamEnrollmentReviewTeams')); assert(gateway.includes('teamDecisionStatus'));
  const service = read('functions/src/services/teamEnrollmentReview.ts');
  assert(service.includes('await requireTeamEnrollmentManager'));
  assert(service.includes('[uid, "team-enrollment-review-teams", clubId, [club.createTime.seconds, club.createTime.nanoseconds]]'));
  assert(service.includes('teamBelongsToCurrentClub'));
  assert(service.includes('query.limit(21)')); assert(service.includes('scanned.at(-1)!.id'));
  assert.doesNotMatch(service, /transaction\.(set|create|update|delete)\(/);
  const fixture = read('scripts/qa/local-team-review-fixture.mjs');
  assert(fixture.includes('await verifyTeamNativeFixture')); assert(fixture.includes('assert.deepEqual(await teamReviewSnapshot(), fixture.before)'));
});
test('backend and web smoke run the real manager service lifecycle and scoped frontend evidence checks', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const source = read('.github/workflows/' + name); assert(source.includes('npm run test:team-review'));
    for (const file of ['controller', 'wire', 'evidence']) assert(source.includes(`tests/team-review-${file}.test.mjs`));
  }
  assert.equal(read('.github/workflows/web-integration-smoke.yml').split('"tests/team-review*.mjs"').length - 1, 2);
});
test('the private portal keeps separate manager-browser and parent-native proof partial', () => {
  const flow = content.flows.find((item) => item.id === 'team-review'); assert.equal(flow.status, 'partial');
  assert.equal(flow.ui.source, base + 'results.json'); assert.deepEqual(flow.ui.groups, ['team-manager-review-ui']);
  assert.equal(flow.images.length, 8); assert(flow.images[0].landscape);
  for (const image of flow.images) assert(captures[image.file].startsWith(base) || captures[image.file].startsWith('docs/release/evidence/phone-team-enrollment-2026-10-19/'));
  assert.match(flow.remaining, /fermeture complète/); assert.match(flow.remaining, /mise en ligne/);
  assert.doesNotMatch(JSON.stringify(flow), /Firebase|BrowserStack|Playwright|SDK|Terraform/);
  validateUiScope(report()); assert.throws(() => validateUiScope({ ...report(), physicalDevice: true }));
  const parent = content.flows.find((item) => item.id === 'team-enrollment'); assert.equal(parent.status, 'partial');
  assert.equal(parent.images.length, 15); assert.equal(parent.checkedAt, '2026-10-19');
  assert(parent.images.every((image) => /19 octobre/.test(image.alt))); assert.match(parent.remaining, /fermeture complète/);
});
