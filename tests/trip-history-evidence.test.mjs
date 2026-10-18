import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertInstrumentationPassed } from '../scripts/qa/android-instrumentation-result.mjs';
import { content } from '../partner-portal/content.mjs';
import { captures } from '../partner-portal/content.mjs';
import { assertRecoveryRestart } from '../scripts/qa/trip-consent-recovery-evidence.mjs';

const base = 'docs/release/evidence/local-trip-history-2026-10-18/';
const bytes = (path) => readFileSync(new URL('../' + path.split('/').map(encodeURIComponent).join('/'), import.meta.url));
const read = (path) => bytes(path).toString('utf8');
const json = (path) => JSON.parse(read(base + path));

test('completed native history/time proof retains all originals, groups, transcripts and scoped restart states', () => {
  const prefix = base + 'completed-native/';
  const hashes = json('completed-native/artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 83);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(prefix + name); assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    if (!name.endsWith('.png')) assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const run = json('completed-native/results.json'); assert.equal(run.runId, 'fa5204526c51182f1de9203112d01814');
  assert.equal(run.testedAt, '2026-10-18T00:56:48.574Z'); assert.equal(run.scope, 'local-ui-not-physical-device');
  assert.equal(run.projectId, 'demo-sgm-local-qa'); assert.equal(run.testCount, 32); assert.equal(run.steps.length, 32);
  assert(run.steps.every((s) => s.status === 'passed'));
  const transcripts = Object.keys(hashes).filter((name) => name.endsWith('-instrumentation.txt')); assert.equal(transcripts.length, 23);
  for (const name of transcripts) assertInstrumentationPassed(read(prefix + name), name.startsWith('LocalAppFlowTest-') ? 9 : 1);
  const copies = Object.keys(hashes).filter((name) => name.startsWith('adb-pull-')); assert.equal(copies.length, 10);
  for (const name of copies) { const copy = json('completed-native/' + name); assert.equal(copy.runId, run.runId); assert.equal(copy.completed, true); }
  assert.deepEqual(json('completed-native/native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const stage = json('completed-native/trip-consent-recovery-ui-stage.json');
  assert.deepEqual(run.tripConsentRecovery, stage); assert.equal(stage.closedHistoryExercised, true);
  assert.equal(stage.recordsUnchanged, true); assert.equal(stage.parentViewsScoped, true);
  assert.equal(stage.outsiderDenied, true);
  assertRecoveryRestart(stage.native.before, stage.native.stopped, stage.native.after,
    Object.fromEntries(stage.checkpoint.map((record) => [record.kind, record])), run.runId);
  assert.equal(stage.native.before.processId, 11289); assert.equal(stage.native.after.processId, 11493);
  for (const record of stage.native.after.records.filter((r) => ['declined', 'withdrawn'].includes(r.kind))) {
    for (const key of ['closedActionsAbsent', 'parentHistoryRestored', 'secondParentHistoryScoped', 'driverHistoryRestored']) assert.equal(record[key], true);
  }
  for (const key of ['applicationExercised', 'routeProviderExercised', 'paymentExercised', 'fullAppReplay']) assert.equal(stage[key], false);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true,
    isArray: (name) => name === 'testcase' }).parse(read(prefix + 'general-ui.xml')).testsuite;
  assert.equal(suite.tests, 111); assert.equal(suite.skipped, 26); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  const cases = suite.testcase.filter((c) => c.classname.endsWith('.TripHistoryFlowTest'));
  assert.equal(cases.length, 3); assert(cases.every((c) => !Object.hasOwn(c, 'skipped')));
  for (const kind of ['declined', 'withdrawn']) {
    assert.equal(captures['trip-history-' + kind], prefix + 'local-trip-history-' + kind + '.png');
    const png = bytes(captures['trip-history-' + kind]); assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 2140);
  }
  assert.match(read(base + 'README.md'), /92ea11dcb87b3c2fc0bf266b437122ce73b23bdb/);
});

test('isolated history service proof preserves actual paging, authority boundaries and read-only records', () => {
  const evidence = json('services.json'), r = evidence.result;
  assert.equal(evidence.projectId, 'demo-sgm-local-qa'); assert.equal(evidence.runId, '0bc861052ea7b29c075f707c2f5cc0de');
  assert.equal(evidence.testedAt, '2026-10-18T00:26:14.277Z');
  assert.equal(evidence.scope, 'isolated-trip-history-services-not-native-or-production');
  assert.equal(r.proposalCount, 13); assert.equal(r.pageSize, 10); assert.deepEqual(r.actorCounts, [13, 13, 13, 7]);
  for (const field of ['microsecondAndIdOrdering', 'scopedReviewBookingIds', 'laterParentCannotSeeEarlierProposals',
    'guardianRevocationDenied', 'signedOutDenied', 'crossAccountCursorDenied', 'crossTripCursorDenied', 'recordsUnchanged',
    'forgedParentListDenied', 'cancelledBookingHistoryPreserved']) assert.equal(r[field], true, field);
  assert.equal(r.beforeHash, r.afterHash); assert.equal(r.cancelledBeforeHash, r.cancelledAfterHash);
  assert.notEqual(r.beforeHash, r.cancelledBeforeHash); assert.match(r.beforeHash, /^[a-f0-9]{64}$/);
  assert.equal(r.nativeUiExercised, false); assert.equal(r.productionDeployed, false);
  const functions = json('functions.json'); assert.equal(functions.numTotalTests, 258);
  assert.equal(functions.numPassedTests, 258); assert.equal(functions.numFailedTests, 0); assert.equal(functions.success, true);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });
  for (const [name, count] of [['ui.TripChangeHistoryStateTest', 4], ['services.TripChangeHistoryMappingTest', 2]]) {
    const suite = parser.parse(read(base + `unit/TEST-be.sportgreenmoove.app.${name}.xml`)).testsuite;
    assert.equal(suite.tests, count); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0); assert.equal(suite.skipped, 0);
  }
});

test('the earlier time-fix replay remains failed and its exact process death matches the active store installation', () => {
  const prefix = base + 'interrupted-time-replay/', hashes = json('interrupted-time-replay/artifact-sha256.json');
  assert.equal(Object.keys(hashes).length, 14);
  for (const [name, hash] of Object.entries(hashes)) {
    const raw = bytes(prefix + name); assert.equal(createHash('sha256').update(raw).digest('hex'), hash, name);
    assert.doesNotMatch(raw.toString(), /AIza[\w-]{20,}|Bearer\s+[\w.-]+|"password"\s*:/);
  }
  const label = 'LocalBookingDecisionsFlowTest';
  const diagnostic = json(`interrupted-time-replay/${label}-diagnostics.json`);
  assert.equal(diagnostic.runId, 'f433b939405b9a05db27b6fb9c6be01d');
  assert.equal(diagnostic.records.length, 7); assert(diagnostic.records.every((r) => r.status === 'collected'));
  assert.equal(read(prefix + label + '-crash.txt'), '');
  assert.throws(() => assertInstrumentationPassed(read(prefix + label + '-instrumentation.txt'), 1));
  assert.match(read(prefix + label + '-exit-info.txt'), /00:25:16\.313 pid=8279[\s\S]*?reason=16 \(PACKAGE UPDATED\)/);
  assert.match(read(prefix + label + '-process-log.txt'), /Killing 8279:be\.sportgreenmoove\.app\.local.*stop com\.google\.android\.gms due to installPackageLI/);
  const installs = JSON.parse(read(prefix + label + '-install-sessions.txt'));
  const session = installs.sections.find((s) => s.kind === 'active').sessions.find((s) => s.id === 1831130581);
  assert.equal(session.appPackageName, 'com.google.android.gms'); assert.equal(session.installInitiatingPackageName, 'com.android.vending');
  assert.equal(session.committedMillis, 1792283116018); assert.equal(session.mCommitted, true);
  assert.match(read(prefix + label + '-frozen-packages.txt'), /package=com\.google\.android\.gms, refCounts=1/);
  assert.deepEqual(json('interrupted-time-replay/native-suite-status.json'), {
    scope: 'native-suite-exit-status-not-flow-verification', ordinaryTests: 0, componentEvidence: 0, localReplay: 1 });
  for (const phase of ['booking-response-loss', 'booking-ui-response-loss', 'failure-cleanup'])
    assert.equal(json(`interrupted-time-replay/adb-pull-${phase}.json`).completed, true);
  assert.match(read(base + 'README.md'), /time assertions[\s\S]*were not reached/);
});

test('history wiring stays separate from approval/application and requires new native proof without replacing past captures', () => {
  const backend = read('functions/src/services/tripChangeHistory.ts');
  for (const required of ['Filter.or(', 'parentUserIds', 'driverUserId', 'orderBy("createdAt", "desc")',
    'orderBy(FieldPath.documentId(), "desc")', 'query.limit(11)', 'requireTripHistoryAccess(', 'requireTripChangeReader(']) assert(backend.includes(required), required);
  assert(!/transaction\.(create|set|update|delete)\(/.test(backend));
  const access = read('functions/src/services/tripHistoryAccess.ts');
  for (const field of ['guardianUserIds', 'reservationSchema.safeParse', 'parentUserId', 'requesterUserId']) assert(access.includes(field));
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripHistoryAssertions.kt');
  assert(native.includes('"reservation.history.$bookingId"')); assert(native.includes('"trip.history.${trip.id}"'));
  assert(native.includes('listOf("accept", "decline", "withdraw", "calculate", "apply", "propose")'));
  const host = read('scripts/qa/local-trip-consent-recovery.mjs');
  assert(host.includes('closedHistoryExercised: true')); assert(host.includes('"parentHistoryRestored"') || host.includes("'parentHistoryRestored'"));
  for (const name of ['declined', 'withdrawn']) assert(host.includes(`'local-trip-history-${name}.png'`));
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.equal(workflow.split('"tests/trip-history-evidence.test.mjs"').length - 1, 2);
  assert(workflow.includes('node scripts/qa/run-local-trip-history.mjs'));
  assert.match(content.blockers.find((b) => b.id === 'trip-management').text, /historique/);
  assert.equal(content.flows.find((f) => f.id === 'publication').status, 'partial');
  assert.match(read(base + 'README.md'), /Completed Native Replay/);
  for (const path of ['functions/src/services/tripChangeHistory.ts', 'functions/src/services/tripHistoryAccess.ts',
    'functions/src/domain/tripChangeHistory.ts', 'android/app/src/main/java/be/sportgreenmoove/app/ui/TripChangeHistoryDialog.kt',
    'android/app/src/main/java/be/sportgreenmoove/app/ui/TripChangeHistoryState.kt', 'scripts/qa/local-trip-history-checks.mjs',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRecoveryTest.kt']) assert(read(path).split('\n').length < 300, path);
});
