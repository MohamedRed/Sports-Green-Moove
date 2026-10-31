import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Timestamp} from 'firebase-admin/firestore';
import {assertSearchDepartureNativeCases} from '../scripts/qa/search-departure-native-cases.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';
import {verifySessionRestorationRecords} from '../scripts/qa/session-restoration-records.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const prefix = 'android/app/src/main/java/be/sportgreenmoove/app/ui/';
const native = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';
test('search uses native pickers without exposing editable wire syntax or inventing a replacement date', () => {
  const screen = read(prefix + 'SearchScreen.kt'), field = read(prefix + 'SearchDepartureField.kt');
  assert(screen.includes('SearchDepartureField(form.desiredDepartureAtIso,'));
  assert(!screen.includes('SearchInput("Date'));
  for (const control of ['DatePickerDialog', 'TimePickerDialog', 'SearchDateInput', 'SearchTimeInput', 'FlowRow']) assert(field.includes(control));
  assert(field.includes('if (instant == null)')); assert(field.includes('le choix affiché est conservé'));
  assert(!field.includes('Instant.now(')); assert(!field.includes('BasicTextField'));
  assert(read(prefix + 'SearchDepartureInput.kt').includes('tripChangeInstant(date, time)'));
});
test('existing full search and option-retention cases use real picker actions, with a stable calendar fixture', () => {
  const parent = read(native + 'LocalParentSearchBookingTest.kt'), criteria = read(native + 'SearchCriteriaFlowTest.kt');
  for (const source of [parent, criteria]) {
    assert(source.includes('chooseSearchDeparture(compose,'));
    assert(!/SearchDateInput\).*performTextReplacement/.test(source));
  }
  assert(criteria.includes('current.form.copy(desiredDepartureAtIso = "2026-10-16T16:30:00Z")'));
  assert(criteria.includes('searches.single().desiredDepartureAtIso'));
  const helper = read(native + 'SearchDeparturePickerInput.kt');
  assert(helper.includes('ComposeTestRule')); assert(helper.includes('enterNativePickerDate(current, target.date)'));
  assert(helper.includes('enterNativePickerTime(target.time)'));
  const host = read(native + 'SearchDepartureFlowTest.kt');
  assert(host.includes('Column(Modifier.verticalScroll(rememberScrollState()))'));
  assert(host.includes('enterNativePickerTime(LocalTime.of(18, 45), confirm = false)'));
  const runner = read('scripts/qa/local-search-booking-ui.mjs');
  for (const source of ['SearchDeparturePickerInput.kt', 'NativeDatePickerInput.kt', 'NativeTimePickerInput.kt',
    'SearchDepartureField.kt', 'SearchDepartureInput.kt']) assert(runner.includes(source));
});
const flowNames = ['nativeDateAndTimePickersProduceTheExpectedWireInstant',
  'cancellingEitherNativePickerPreservesTheAcceptedChoiceWithoutAnEdit',
  'aMissingLocalHourIsRejectedAndCanBeCorrectedWithoutReplacingTheChoice',
  'aRepeatedLocalHourNeverSilentlyChoosesOneOffset', 'invalidWireInputIsExplicitAndDoesNotInventAnotherDeparture'];
const fixture = () => {
  const rows = (name, methods) => methods.map(method => ({className: 'be.sportgreenmoove.app.ui.' + name,
    name: method, status: 'passed', reason: null}));
  const cases = [...rows('SearchDepartureFlowTest', flowNames),
    ...rows('SearchDepartureLayoutTest', [false, true].flatMap(dark => [320, 900].map(width =>
      `enlargedDateAndTimeFitBothResponsiveFormatsWithoutOverlap[dark-${dark}-width-${width}]`))),
    ...rows('SearchCriteriaFlowTest', ['navigationRetainsOptionsAndBookingUsesTheCompletedSelection',
      'eachOptionChangeRemovesResultsAndRejectsThePreviousBookingAction'])];
  return {scope: 'complete-android-junit-instrumentation-not-physical-or-release-proof', complete: true,
    guardConfirmed: true, caseCount: 11, passed: 11, skipped: 0, failed: 0, cases};
};
test('the evidence selector requires all five actions, four layouts and both migrated option cases', () => {
  assert.equal(assertSearchDepartureNativeCases(fixture()).length, 11);
});
test('parameter identities remain compatible with the unchanged strict Android transcript decoder', () => {
  assert(read(native + 'SearchDepartureLayoutTest.kt').includes('@Parameterized.Parameters(name = "dark-{0}-width-{1}")'));
  const cases = fixture().cases;
  const packets = ['INSTRUMENTATION_STATUS: sgm_installations_blocked=true\nINSTRUMENTATION_STATUS_CODE: 0'];
  for (const [index, row] of cases.entries()) for (const code of [1, 0])
    packets.push(`INSTRUMENTATION_STATUS: class=${row.className}\nINSTRUMENTATION_STATUS: test=${row.name}\n` +
      `INSTRUMENTATION_STATUS: numtests=${cases.length}\nINSTRUMENTATION_STATUS: current=${index + 1}\nINSTRUMENTATION_STATUS_CODE: ${code}`);
  packets.push(`OK (${cases.length} tests)\nINSTRUMENTATION_CODE: -1`);
  assert.equal(assertSearchDepartureNativeCases(parseAndroidJUnitTranscript(packets.join('\n'))).length, 11);
});
for (const [label, mutate] of [
  ['incomplete suite', report => {report.complete = false;}],
  ['unconfirmed guard', report => {report.guardConfirmed = false;}],
  ['missing action', report => {report.cases.shift(); report.caseCount--; report.passed--;}],
  ['duplicate action', report => {report.cases[1] = {...report.cases[0]};}],
  ['skipped action', report => {report.cases[0].status = 'skipped'; report.skipped++; report.passed--;}],
  ['failed action', report => {report.cases[0].status = 'failed'; report.failed++; report.passed--;}],
  ['missing layout', report => {report.cases[5].className = 'different.Class';}],
  ['incomplete retention', report => {report.cases.at(-1).status = 'skipped'; report.skipped++; report.passed--;}],
]) test(`a coherently counted ${label} cannot inherit a passing picker result`, () => {
  const report = fixture(); mutate(report); assert.throws(() => assertSearchDepartureNativeCases(report));
});
test('serialized post-failure comparisons preserve timestamp seconds and nanoseconds', () => {
  const state = time => ({documents: {sample: [{id: 'owned', data: {updatedAt: time}}]}, claims: [], liveTrips: null});
  const normalize = input => JSON.parse(JSON.stringify(input));
  const before = normalize(state(new Timestamp(100, 123)));
  assert.doesNotThrow(() => verifySessionRestorationRecords(before, normalize(state(new Timestamp(100, 123)))));
  for (const time of [new Timestamp(101, 123), new Timestamp(100, 124)])
    assert.throws(() => verifySessionRestorationRecords(before, normalize(state(time))));
});
