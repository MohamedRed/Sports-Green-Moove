import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {content} from '../../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '../..'), input = process.argv[2]; assert(input?.startsWith('/'));
const folder = resolve(root, 'docs/release/evidence/publication-price-2026-11-05');
const baselineCommit = '85ec9e9274344eefaf7ce63eef36869a22da3489';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(resolve(input, name), 'utf8');
const parser = new XMLParser({ignoreAttributes: false, isArray: name => name === 'testcase'});
function suite(text) {
  const row = parser.parse(text).testsuite;
  return {name: row['@_name'], tests: Number(row['@_tests']), failures: Number(row['@_failures']),
    errors: Number(row['@_errors']), skipped: Number(row['@_skipped']), timestamp: row['@_timestamp'],
    cases: row.testcase.map(test => ({name: test['@_name'], seconds: Number(test['@_time']),
      status: test.failure ? 'failed' : test.error ? 'error' : test.skipped ? 'skipped' : 'passed',
      ...(test.failure ? {failure: test.failure['@_message']} : {})}))};
}
const swiftBaseline = JSON.parse(read('sgm-publication-price-baseline-20261105.json'));
assert.equal(swiftBaseline.sourceCommit, baselineCommit); assert.equal(swiftBaseline.cases[0].actual, 28);
assert.equal(swiftBaseline.cases.filter(row => row.crashed).length, 3);
const androidBaseline = suite(read('sgm-publication-price-android-baseline-20261105.xml'));
assert.equal(androidBaseline.tests, 4); assert.equal(androidBaseline.failures, 1);
assert(androidBaseline.cases.some(row => row.failure?.includes('invalid expected null, but was:') && row.failure.includes('priceCents=0')));
const junit = resolve(root, 'android/app/build/test-results/testDebugUnitTest');
const android = readdirSync(junit).filter(name => name.endsWith('.xml')).sort()
  .map(name => suite(readFileSync(resolve(junit, name), 'utf8')));
const total = key => android.reduce((sum, row) => sum + row[key], 0);
assert.equal(total('tests'), 846); assert.equal(total('failures') + total('errors') + total('skipped'), 0);
for (const name of ['domain.PublishDraftFactoryTest', 'domain.TripPriceInputTest', 'ui.TripChangeDraftTest'])
  assert(android.some(row => row.name === 'be.sportgreenmoove.app.' + name && row.tests >= 4));
const native = read('sgm-publication-price-ios-recheck-20261105.log');
assert(native.includes('exact cents across 100001 supported amounts')); assert(native.includes('SportsGreenMooveNativeChecks passed'));
const focused = read('sgm-publication-price-swift-focused-20261105.log'); assert(focused.includes('no screen or provider'));
assert(read('sgm-publication-price-android-all-20261105.log').includes('BUILD SUCCESSFUL'));
mkdirSync(folder, {recursive: true}); assert(!existsSync(resolve(folder, 'summary.json')));
const records = [];
function record(file, value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  assert(!/Bearer\s+[\w.~+/-]+=*|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]*/.test(bytes));
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); records.push({file, sha256: sha(bytes)});
}
record('swift-baseline.json', swiftBaseline); record('android-baseline.json', androidBaseline);
record('android-recheck.json', android); record('native-recheck.txt', native); record('swift-focused.txt', focused);
record('portal-before.json', {flows: content.flows.map(row => ({id: row.id, sha256: sha(JSON.stringify(row))})),
  updates: content.updates.map(row => sha(JSON.stringify(row))), blockers: sha(JSON.stringify(content.blockers))});
const paths = ['ios/Sources/SportsGreenMooveApp/TripPublicationPrice.swift', 'ios/Sources/SportsGreenMooveApp/PublishScreen.swift',
  'ios/Sources/SportsGreenMooveApp/PublishSteps.swift', 'ios/Tests/SportsGreenMooveNativeChecks/TripPublicationPriceChecks.swift',
  'android/app/src/main/java/be/sportgreenmoove/app/domain/PublishDraftFactory.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/domain/TripPriceInput.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/domain/TripChangeInput.kt',
  'android/app/src/main/java/be/sportgreenmoove/app/ui/PublishScreen.kt',
  'android/app/src/test/java/be/sportgreenmoove/app/domain/PublishDraftFactoryTest.kt',
  'android/app/src/test/java/be/sportgreenmoove/app/domain/TripPriceInputTest.kt', 'scripts/qa/check-publication-price.mjs'];
const baselinePaths = [paths[1], paths[4], paths[6]];
const files = [];
for (const commit of [baselineCommit, null]) for (const path of commit ? baselinePaths : paths) {
  const bytes = commit ? execFileSync('git', ['show', `${commit}:${path}`], {cwd: root}) : readFileSync(resolve(root, path));
  const hash = sha(bytes), target = resolve(root, 'docs/release/evidence/source-archive', hash + '.txt');
  if (!existsSync(target)) writeFileSync(target, bytes, {flag: 'wx'});
  assert.equal(sha(readFileSync(target)), hash); files.push({path, commit: commit ?? 'candidate', sha256: hash});
}
record('source-sha256.json', {files});
record('summary.json', {checkedAt: '2026-11-05', baselineCommit, swiftBaselineWrongCents: true,
  swiftBaselineTrappingInputs: 3, androidBaselineInvalidFreeTripReproduced: true,
  swiftExactCentAmounts: 100001, androidExactCentAmounts: 100001, androidUnitSuites: android.length,
  androidUnitCases: total('tests'), androidUnitFailures: 0, localNativeChecks: 'passed', focusedSwiftCheck: 'passed',
  invalidPricesRejected: true, blankPublicationPriceRemainsFree: true, tripEditingBlankStillRejected: true,
  currentNativeScreenAccepted: false, publicationAuthorityAccepted: false, physicalDeviceAccepted: false,
  commissionPolicyChanged: false, productionWrites: 0, providerRequests: 0, newPhoneSessions: 0,
  newMedia: 0, releaseComplete: false, records: [...records]});
console.log('Retained exact-price negative reproductions and controlled Swift/JVM positives; native screens and release remain unaccepted.');
