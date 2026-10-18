import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { content, captures } from '../partner-portal/content.mjs';
import { validateUiScope } from '../partner-portal/validate.mjs';

const root = new URL('../', import.meta.url);
const base = 'docs/release/evidence/local-trip-change-native-2026-10-17/';
const bytes = (path) => readFileSync(new URL(path, root));
const read = (path) => bytes(path).toString('utf8');
const json = (file) => JSON.parse(read(base + file));
const xml = (file) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
  processEntities: false, isArray: (name) => name === 'testcase' }).parse(read(base + file)).testsuite;
const changeCases = (suite) => suite.testcase.filter((item) => item.classname === 'be.sportgreenmoove.app.ui.TripChangeFlowTest');
const failed = (item) => Object.hasOwn(item, 'failure') || Object.hasOwn(item, 'error');

test('fresh isolated service evidence binds recovery, affected parents and application without accepting real money movement', () => {
  const run = json('services.json');
  assert.equal(run.runId, 'c3c68ee9bdc74be604c3248adf880746');
  assert.equal(run.testedAt, '2026-10-17T10:35:49.656Z');
  assert.equal(run.scope, 'local-emulated-services-not-phone-ui'); assert.equal(run.projectId, 'demo-sgm-local-qa');
  assert.equal(run.steps.length, 24); assert(run.steps.every((item) => item.status === 'passed'));
  assert.equal(run.tripChanges.parentCount, 2); assert.equal(run.tripChanges.acceptedParentCount, 2);
  for (const key of ['callerOnlyRequestMetadata', 'reservationReviewLinksScoped', 'readOnlyProposalResolution',
    'originalTripAndBookingsPreserved', 'parentViewsScoped']) assert.equal(run.tripChanges[key], true, key);
  for (const key of ['explicitExpiredQuoteRecovery', 'laterBookingExcludedFromPriorProposal', 'quoteResponseBoundToRequest',
    'originalInvoicesPreserved', 'paidBalanceBlocksStart', 'unpaidEditedTripBlockedUntilPayment']) assert.equal(run.tripApplication[key], true, key);
  assert.equal(run.tripChanges.nativeUi, false); assert.equal(run.tripApplication.nativeUi, false);
  for (const key of ['liveMaps', 'livePayment', 'refundIssued', 'productionDeployed']) assert.equal(run.tripApplication[key], false, key);
  assert.equal(run.tripApplication.syntheticRouteQuote, true); assert.equal(run.tripApplication.syntheticPaymentEvents, true);
});

test('actual unit and protected-write reports retain their narrower verification scope', () => {
  const unit = json('unit-summary.json');
  assert.equal(unit.sourceCommit, 'c7f8ec045535f8a3034a638261e6a17d6ef7077b');
  assert.deepEqual(unit.totals, { tests: 196, failures: 0, errors: 0, skipped: 0 });
  assert.equal(unit.instrumentedScreensExecuted, false);
  assert.equal(unit.focused.reduce((sum, item) => sum + item.tests, 0), 31);
  for (const [file, count] of [['services.TripChangeMappingTest', 7], ['ui.TripChangeDraftTest', 6], ['ui.TripChangeStateTest', 18]]) {
    const suite = xml(`unit/TEST-be.sportgreenmoove.app.${file}.xml`);
    assert.equal(suite.tests, count); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 0);
    assert.equal(suite.testcase.length, count); assert(suite.testcase.every((item) => !failed(item)));
  }
  const rules = json('rules.json');
  assert.equal(rules.success, true); assert.equal(rules.numTotalTests, 100); assert.equal(rules.numPassedTests, 100);
  assert.equal(rules.numFailedTests, 0); assert.equal(rules.numPendingTests, 0);
  assert.equal(rules.testResults[0].assertionResults.length, 100);
  const previous = json('before-resolution/unit-summary.json');
  assert.equal(previous.totals.tests, 193); assert.equal(previous.focused.reduce((sum, item) => sum + item.tests, 0), 28);
});

test('first failed component run is preserved and cannot be relabelled as network preparation or a complete replay', () => {
  const suite = xml('first-screen-run/general-ui.xml');
  const summary = json('first-screen-run/summary.json');
  assert.equal(summary.sourceCommit, 'c7f8ec045535f8a3034a638261e6a17d6ef7077b');
  assert.equal(summary.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39025520745');
  for (const key of ['tests', 'failures', 'errors', 'skipped']) assert.equal(suite[key], summary.suite[key]);
  const cases = changeCases(suite);
  assert.equal(cases.length, 7); assert.equal(cases.filter(failed).length, 2);
  assert.equal(cases.filter((item) => !failed(item)).length, 5);
  assert.equal(summary.fullIsolatedReplayStarted, false);
  assert.deepEqual(cases.filter(failed).map((item) => item.name).sort(), summary.failures.map((item) => item.case).sort());
  assert.match(cases.find((item) => item.name.startsWith('refreshRecovers')).failure, /after 10000 ms/);
  assert.match(cases.find((item) => item.name.startsWith('parentOpens')).failure, /no parent layout with a Scroll SemanticsAction/);
});

test('seven component cases passed while the broader cancellation regression and rejected map captures stay explicit', () => {
  const run = json('results.json');
  validateUiScope(run);
  assert.equal(run.sourceCommit, '781b925b00e3bdf72c0e7b5e63cf07f9e2cf873b');
  assert.equal(run.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39026693680');
  assert.equal(run.testedAt, '2026-10-17T11:05:22Z');
  const suite = xml(run.report), cases = changeCases(suite);
  assert.equal(cases.length, 7); assert.equal(run.steps.length, 7);
  assert(cases.every((item) => !failed(item) && !Object.hasOwn(item, 'skipped')));
  assert.deepEqual(run.steps.map((item) => item.case).sort(), cases.map((item) => item.name).sort());
  for (const key of ['tests', 'failures', 'errors', 'skipped']) assert.equal(run.broaderSuite[key], suite[key]);
  assert.equal(run.broaderSuite.ciConclusion, 'failure'); assert.equal(run.broaderSuite.fullIsolatedReplayStarted, false);
  const failures = suite.testcase.filter(failed); assert.equal(failures.length, 1);
  assert.equal(failures[0].name, run.broaderSuite.failedCase);
  assert.match(failures[0].failure, /TripFormTestInput.kt:34/);
  assert.equal(run.captureReview.publishable, false); assert.equal(run.captureReview.count, 5);
  assert(!Object.values(captures).some((path) => path.startsWith(base + 'compose-captures/')));
});

test('partner progress stays partial, dates historical captures and excludes unapproved map images', () => {
  const flow = content.flows.find((item) => item.id === 'publication');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-18'); assert.equal(flow.local.checkedAt, '2026-10-17');
  assert.equal(flow.source, 'docs/release/evidence/real-maps-local-2026-10-18/README.md');
  assert.equal(flow.local.source, base + 'services.json');
  assert.equal(flow.ui.source, 'docs/release/evidence/local-trip-history-2026-10-18/completed-native/results.json');
  assert.deepEqual(flow.ui.groups, ['driver-trip-cancellation-ui', 'trip-change-parent-confirmation-ui', 'trip-change-inputs-ui', 'trip-change-schedule-ui', 'trip-consent-process-restart-ui', 'trip-consent-pending-restart-ui', 'trip-consent-partial-restart-ui', 'trip-consent-declined-restart-ui', 'trip-consent-withdrawn-restart-ui']);
  assert.match(flow.verified, /Deux parents/);
  assert.match(flow.remaining, /brouillons après fermeture/);
  assert.match(flow.remaining, /changement de parcours et l’application/);
  assert.match(flow.remaining, /paiements et remboursements réels/); assert.match(flow.remaining, /pas encore en ligne/i);
  assert.equal(flow.images.length, 18);
  const historical = flow.images.filter((item) => item.file.startsWith('trip-cancel-'));
  assert.equal(historical.length, 3);
  assert(historical.every((item) => item.alt.includes('16 octobre') && captures[item.file].includes('local-trip-cancellation-ui-2026-10-16')));
  assert(content.updates.some((item) => item.flow === 'publication' && item.date === '2026-10-17' && /Sept essais d’écran simulés/.test(item.text)));
});

test('raw artifacts, including failures and rejected images, remain byte-exact and mandatory in smoke CI', () => {
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 20);
  for (const [name, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(bytes(base + name)).digest('hex'), hash, name);
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-change-native-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('run: node --test tests/trip-change-native-evidence.test.mjs'));
});
