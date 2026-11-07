import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {publicationPrice, publicationPriceProgress} from '../partner-portal/publication-price.mjs';
import {partitionUpdates} from '../partner-portal/src/render.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const dir = 'docs/release/evidence/publication-price-2026-11-05/';
const report = json(publicationPrice.source);

test('exact old publication code retains its wrong cent, invalid free-trip and process-trap outcomes', () => {
  for (const row of report.records) assert.equal(sha(read(dir + row.file)), row.sha256);
  for (const row of json(dir + 'source-sha256.json').files)
    assert.equal(sha(read('docs/release/evidence/source-archive/' + row.sha256 + '.txt')), row.sha256);
  const baseline = json(dir + 'swift-baseline.json');
  assert.equal(baseline.sourceCommit, '85ec9e9274344eefaf7ce63eef36869a22da3489');
  assert.equal(baseline.cases[0].input, '0.29'); assert.equal(baseline.cases[0].actual, 28);
  assert.equal(baseline.cases.find(row => row.input === 'invalid').actual, 0);
  assert.deepEqual(baseline.cases.filter(row => row.crashed).map(row => row.input), ['NaN', 'Infinity', '1e300']);
  const android = json(dir + 'android-baseline.json'); assert.equal(android.tests, 4); assert.equal(android.failures, 1);
  assert(android.cases.some(row => row.status === 'failed' && row.failure.includes('priceCents=0')));
});

test('actual exact-price checks and all Android JVM methods pass without replacing screen acceptance', () => {
  assert(read(dir + 'native-recheck.txt').includes('SportsGreenMooveNativeChecks passed'));
  assert(read(dir + 'swift-focused.txt').includes('exact cents across 100001 supported amounts'));
  const suites = json(dir + 'android-recheck.json'); assert.equal(suites.length, 120);
  assert.equal(suites.reduce((sum, row) => sum + row.tests, 0), 846);
  for (const row of suites) {
    assert.equal(row.failures + row.errors + row.skipped, 0);
    assert.equal(row.cases.length, row.tests); assert(row.cases.every(item => item.status === 'passed'));
  }
  for (const key of ['currentNativeScreenAccepted', 'publicationAuthorityAccepted', 'physicalDeviceAccepted',
    'commissionPolicyChanged', 'releaseComplete']) assert.equal(report[key], false);
  assert.equal(report.swiftExactCentAmounts, 100001); assert.equal(report.androidExactCentAmounts, 100001);
});

test('both confirmation and publication use strict exact input rather than floating-point or free-price substitution', () => {
  const swift = read('ios/Sources/SportsGreenMooveApp/PublishScreen.swift');
  assert(swift.includes('onNext: nextFromDetails')); assert(swift.includes('private func nextFromDetails()'));
  assert(swift.includes('guard let priceCents = TripPublicationPrice.cents(price)'));
  assert(swift.includes('makeDraft(priceCents: priceCents)')); assert(swift.includes('priceCents: priceCents'));
  assert(!swift.includes('private func parsePriceCents'));
  assert(read('ios/Sources/SportsGreenMooveApp/PublishSteps.swift').includes('summary("Prix", TripPublicationPrice.label(price))'));
  const android = read('android/app/src/main/java/be/sportgreenmoove/app/ui/PublishScreen.kt');
  assert.equal(android.split('publicationPriceCents(price) == null').length - 1, 2);
  assert(android.includes('"Prix" to publicationPriceLabel(price)'));
  const factory = read('android/app/src/main/java/be/sportgreenmoove/app/domain/PublishDraftFactory.kt');
  assert(factory.includes('val priceCents = publicationPriceCents(price) ?: return null'));
  assert(!factory.includes('toDoubleOrNull') && !factory.includes('roundToInt'));
  assert(read('android/app/src/main/java/be/sportgreenmoove/app/domain/TripChangeInput.kt').includes('tripChangePriceCents(value: String): Int? = tripPriceCents(value)'));
  assert(read('scripts/check-ios-native-plan.sh').includes('TripPublicationPriceChecks.swift'));
});

test('smoke runs the actual model and contract checks while preserving all existing gates and public history', () => {
  const workflow = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/publication-price-input.test.mjs'));
  assert(Object.values(workflow.jobs).some(job => job.steps?.some(step =>
    step.run === 'node scripts/qa/check-publication-price.mjs && node --test tests/publication-price-input.test.mjs')));
  assert.deepEqual(content.publicationPrice, publicationPrice);
  const {recent, previous} = partitionUpdates(content.updates);
  assert([...recent, ...previous].some(row => row.source === publicationPriceProgress.source));
  assert.doesNotMatch(publicationPriceProgress.title + publicationPriceProgress.text, /Firebase|BrowserStack|Android|SDK|Swift|BigDecimal|CI\b/);
  const before = json(dir + 'portal-before.json'); assert.equal(before.updates.length, 446);
  for (const row of before.flows) assert.equal(sha(JSON.stringify(content.flows.find(flow => flow.id === row.id))), row.sha256);
  for (const hash of before.updates) assert(content.updates.some(row => sha(JSON.stringify(row)) === hash));
  assert.equal(sha(JSON.stringify(content.blockers)), before.blockers);
});
