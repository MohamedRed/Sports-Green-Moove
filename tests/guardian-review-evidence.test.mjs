import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { content, captures } from '../partner-portal/content.mjs';
import { validateUiScope } from '../partner-portal/validate.mjs';
import { assertOriginalPaginationSources } from './helpers/original-pagination-sources.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url));
const base = 'docs/release/evidence/local-guardian-review-2026-10-18/';
const run = JSON.parse(read(base + 'results.json'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('guardian review retains a complete real HTTP and management browser run with original captures', () => {
  assert.equal(hash(read(base + 'results.json')), 'b1bbaa1f92804571369bf81ab3a21b08250ded619349aea5e9e8d3f226bf18c5');
  assert.equal(run.runId, '1397a836afc2cb1a87e8a8ebf834092a');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.testedAt.slice(0, 10), '2026-10-18');
  assert.equal(run.checks.length, 16); assert.equal(run.testCount, 16);
  assert(run.checks.every((item) => item.status === 'passed'));
  assert.equal(new Set(run.checks.map((item) => item.id)).size, 16);
  assert.equal(run.browser.checks.length, 9); assert(run.browser.checks.every((item) => item.status === 'passed'));
  assert.equal(run.browser.scope, 'local-management-browser-not-native-or-physical');
  assert.deepEqual(run.browser.viewports, [1440, 768, 390, 320]);
  assert.equal(run.providerRequests, 0); assert.equal(run.browser.externalRequests, 0);
  for (const field of ['productionWrites', 'physicalDevice', 'teamChatImplemented', 'childEmergencyImplemented']) assert.equal(run[field], false);
  assert(run.browser.checks.some((item) => item.id === 'lost-reply-clears-stale-actions-and-reload-reconciles-real-result'));
  assert(run.checks.some((item) => item.id === 'combined-admin-role-does-not-expand-managed-clubs'));
  assert(run.checks.some((item) => item.id === 'historical-request-does-not-grant-current-child-profile-access'));
  const digests = JSON.parse(read(base + 'artifact-sha256.json'));
  assert.equal(Object.keys(digests).length, 9);
  for (const [file, digest] of Object.entries(digests)) {
    assert.match(file, /^(results\.json|guardian-[a-z0-9-]+\.png)$/);
    const bytes = read(base + file); assert.equal(hash(bytes), digest, file);
    if (file.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  assertOriginalPaginationSources(run.sourceFiles, ['functions/src/callables/guardianLists.ts', 'admin/src/guardianReviewWire.ts']);
  const earlier = base + 'before-profile-privacy-guard/';
  for (const [file, digest] of Object.entries(JSON.parse(read(earlier + 'artifact-sha256.json')))) assert.equal(hash(read(earlier + file)), digest);
  for (const file of ['functions/src/services/guardianLists.ts', 'functions/src/callables/guardianLists.ts',
    'admin/src/GuardianReviewPanel.tsx', 'admin/src/GuardianReviewController.ts', 'admin/src/guardianReviewGateway.ts',
    'admin/src/guardianReviewWire.ts', 'scripts/qa/local-guardian-review-suite.mjs', 'scripts/qa/local-guardian-review-browser.mjs'])
    assert(read(file).toString().split('\n').length < 300, file);
});

test('the private website keeps separate management images alongside the scoped native parent proof', () => {
  const flow = content.flows.find((item) => item.id === 'clubs');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-18');
  assert.equal(flow.local.checkedAt, '2026-10-16');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-guardian-parent-native-2026-10-18/guardian-parent-results.json'); validateUiScope(run);
  assert.match(flow.remaining, /fermeture complète/);
  assert.equal(content.flows.find((item) => item.id === 'tracking').status, 'blocked');
  for (const file of ['guardian-review-desktop', 'guardian-review-confirmation', 'guardian-review-verified']) {
    assert(flow.images.some((image) => image.file === file)); assert(captures[file].startsWith(base));
  }
  const incomplete = structuredClone(run); incomplete.browser.checks[0].status = 'failed';
  assert.throws(() => validateUiScope(incomplete));
  const unsafe = structuredClone(run); unsafe.browser.externalRequests = 1;
  assert.throws(() => validateUiScope(unsafe));
});

test('CI reruns private review listing and decision state without requiring paid devices or production data', () => {
  for (const file of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = read('.github/workflows/' + file).toString();
    assert(workflow.includes('npm run test:guardian-review && node --test tests/guardian-review-controller.test.mjs tests/guardian-review-evidence.test.mjs'));
  }
  const smoke = read('.github/workflows/web-integration-smoke.yml').toString();
  for (const file of ['guardian-review-controller', 'guardian-review-evidence'])
    assert.equal(smoke.split(`"tests/${file}.test.mjs"`).length - 1, 2);
  const service = read('functions/src/services/guardianLists.ts').toString();
  assert(service.includes('requireRole(token, reviewing ? "clubManager" : "parent")'));
  assert(service.includes('firestore.runTransaction')); assert(service.includes('query.limit(21)'));
  assert.doesNotMatch(service, /requireMembershipReviewer|hasRole\(|transaction\.(create|update|delete|set)\(/);
  const gateway = read('admin/src/guardianReviewGateway.ts').toString();
  assert.equal(gateway.split('auth.currentUser?.uid !== uid').length - 1, 1);
  assert(gateway.includes('auth?.currentUser?.uid !== uid'));
  assert(gateway.includes('"listGuardianReviewClubs"'));
  assert(read('admin/src/ClubDashboard.tsx').toString().includes('<GuardianReviewPanel uid={uid} />'));
});
