import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { content } from '../partner-portal/content.mjs';

const base = 'docs/release/evidence/local-trip-dates-2026-10-18/';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const report = (name) => JSON.parse(read(base + name + '.json'));

test('the reported timezone bug fails before the fix and the same 15 cases pass in three processes', () => {
  const before = report('before-utc');
  assert.equal(before.numTotalTests, 15); assert.equal(before.numFailedTests, 14); assert.equal(before.success, false);
  const names = before.testResults[0].assertionResults.map((r) => r.fullName.replace(/Mon Oct 19 .*?\)/, 'DATE'));
  for (const zone of ['utc', 'los-angeles', 'tokyo']) {
    const after = report('after-' + zone);
    assert.equal(after.numTotalTests, 15); assert.equal(after.numPassedTests, 15);
    assert.equal(after.numFailedTests, 0); assert.equal(after.success, true);
    assert(after.startTime > before.startTime); assert(after.testResults[0].assertionResults.every((r) => r.status === 'passed'));
    // Date.toString in Vitest's parameter title reflects the process timezone.
    assert.deepEqual(after.testResults[0].assertionResults.map((r) => r.fullName.replace(/(?:Mon|Sun) Oct (?:18|19) .*?\)/, 'DATE')), names);
  }
  const all = report('all-functions');
  assert.equal(all.numTotalTests, 255); assert.equal(all.numPassedTests, 255); assert.equal(all.success, true);
  const services = report('services');
  assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.steps.length, 24); assert(services.steps.every((s) => s.status === 'passed'));
  assert.match(services.testedAt, /^2026-10-18T/);
});

test('native mapper and calendar regressions retain failing originals and successful unit results', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true });
  for (const [name, count, previousFailures] of [['services.TripDateMappersTest', 30, 30], ['domain.TripCalendarTest', 3, 1]]) {
    const path = `TEST-be.sportgreenmoove.app.${name}.xml`;
    const before = parser.parse(read(base + 'before-android/' + path)).testsuite;
    const after = parser.parse(read(base + 'after-android/' + path)).testsuite;
    assert.equal(before.tests, count); assert.equal(before.failures, previousFailures);
    assert.equal(after.tests, count); assert.equal(after.failures, 0); assert.equal(after.errors, 0); assert.equal(after.skipped, 0);
  }
  assert.match(read(base + 'swift-native-checks.txt'), /TripDateLabelChecks passed: 30 date\/time pairs across 3 device timezones/);
  assert.match(read(base + 'swift-native-checks.txt'), /SportsGreenMooveNativeChecks passed/);
});

test('CI reruns timezone cases and native replay checks both direct and reservation times without claiming a completed replay', () => {
  const workflow = read('.github/workflows/web-integration-smoke.yml');
  assert.match(workflow, /for timezone in UTC America\/Los_Angeles Asia\/Tokyo/);
  assert.match(workflow, /TZ="\$timezone" npm test --workspace functions -- src\/__tests__\/client-trip-dates.test.ts/);
  const host = read('scripts/qa/local-trip-consent-recovery.mjs');
  assert.match(host, /expectedTimeLabel: new Intl.DateTimeFormat/); assert.match(host, /timeZone: 'Europe\/Brussels'/);
  const native = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/LocalTripConsentRecoveryTest.kt');
  assert.match(native, /assertEquals\(expectedTime, trip\(fixture\).timeLabel\)/);
  assert(native.includes('hasText(" · $expectedTime", substring = true)'));
  const gap = content.blockers.find((b) => b.id === 'booking-time-display');
  assert.equal(gap.source, base + 'README.md'); assert.match(gap.next, /Rejouer dans l’app/);
  assert.match(gap.next, /pas encore en ligne/);
  assert.equal(content.flows.find((f) => f.id === 'publication').status, 'partial');
  assert.match(read(base + 'README.md'), /no successful replay of the changed source is recorded here/);
});
