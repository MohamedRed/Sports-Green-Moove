import assert from 'node:assert/strict';
import {readFileSync, cpSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {parse} from 'yaml';
import {content, captures} from '../partner-portal/content.mjs';
import {assertReviewDisplayEvidence, reviewDisplayFolder, validateReviewDisplayEvidence} from '../scripts/qa/review-display-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, reviewDisplayFolder);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
const report = () => ({summary: json('summary'), ordinary: json('prior-ordinary-results'), units: json('android-unit-counts'),
  restoration: json('recovery/session-restoration-results'), proxy: json('recovery/session-restoration-proxy'),
  disposal: json('disposal'), installed: json('installed-apks')});
test('retains original failures and narrow local passes without promoting them to a release', () => {
  assert.equal(validateReviewDisplayEvidence(root).componentCasesPassed, 6);
  const ratings = content.flows.find(row => row.id === 'ratings'), recovery = content.flows.find(row => row.id === 'session-restoration');
  assert.equal(ratings.status, 'partial'); assert.equal(ratings.images.filter(row => !row.file.startsWith('review-trip-')).length, 23);
  assert.match(ratings.images.find(row => row.file === 'rating-accessible-count').alt, /fictif/);
  assert.equal(ratings.tour.length, 4); assert.equal(recovery.status, 'partial'); assert.equal(recovery.images.length, 10);
  assert.equal(recovery.checkedAt, '2026-10-29'); assert.match(recovery.remaining, /vraie coupure/);
  assert.equal(recovery.latestEvidence, 'local'); assert.equal(captures['rating-accessible-count'], reviewDisplayFolder + 'received-ratings-large-text.png');
  assert.equal(captures['session-current-error'], reviewDisplayFolder + 'recovery/local-session-restoration-error.png');
});
test('native assertions check actual rendered lines, all digits and refresh separation', () => {
  const source = readFileSync(resolve(root, 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/ReceivedRatingsFlowTest.kt'), 'utf8');
  for (const required of ['width(280.dp)', '1.8f', '9_007_199_254_740_991L', 'isLineEllipsized', 'getLineRight',
    'getLineBottom', 'getLineEnd', 'text.right < refresh.left', '9 007 199 254 740 991 avis reçus', 'captureLocalUi']) assert(source.includes(required));
  assert(!source.includes('hasVisualOverflow')); assert(!source.includes('@Ignore'));
});
test('both web smoke triggers retain the display/recovery evidence test and execute it', () => {
  const source = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert.equal(source.split('"tests/review-display-evidence.test.mjs"').length - 1, 2);
  const workflow = parse(source), step = workflow.jobs.smoke.steps.find(row => row.name === 'Test private received rating summaries');
  assert.match(step.run, /tests\/review-display-evidence.test.mjs/);
});
for (const [name, mutate] of [
  ['fabricated clipping repair', row => {row.summary.averageClippingDefectProven = true;}],
  ['full gate inflation', row => {row.summary.fullNativeGatePassed = true;}],
  ['physical-device inflation', row => {row.summary.physicalDeviceTested = true;}],
  ['real network-loss inflation', row => {row.restoration.realNetworkLossVerified = true;}],
  ['release acceptance', row => {row.summary.releaseComplete = true;}],
  ['erased baseline failure', row => {row.ordinary.failed = 0;}],
  ['missing component execution', row => {row.summary.componentCasesPassed = 0;}],
  ['foreign summary owner', row => {row.proxy.attempts.at(-1).uid = 'another-user';}],
  ['failed proxy', row => {row.proxy.failed = true;}],
  ['changed records', row => {row.restoration.fixtureIsolation.allUserClaimsUnchanged = false;}],
  ['unclosed runtime', row => {row.restoration.isolatedEnvironmentDestroyed = false;}],
  ['open local service', row => {row.disposal.ports[0].available = false;}],
  ['unverified installed bytes', row => {row.installed.records[0].installedBytesVerified = false;}],
]) test('rejects ' + name, () => {const value = report(); mutate(value); assert.throws(() => assertReviewDisplayEvidence(value));});
test('a modified native image is rejected', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-review-display-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, resolve(temp, reviewDisplayFolder), {recursive: true});
  writeFileSync(resolve(temp, reviewDisplayFolder, 'received-ratings-large-text.png'), 'not original');
  assert.throws(() => validateReviewDisplayEvidence(temp), /received-ratings-large-text.png/);
});
