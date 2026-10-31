import assert from 'node:assert/strict';

export const searchDepartureCandidate = '8e0b1c5ceeb25145a4ecbb36985c03ae55086a76';
export function assertSearchDepartureNativeCases(report) {
  assert.equal(report.scope, 'complete-android-junit-instrumentation-not-physical-or-release-proof');
  assert.equal(report.complete, true); assert.equal(report.guardConfirmed, true);
  assert.equal(report.caseCount, report.cases.length);
  for (const [field, status] of [['passed', 'passed'], ['skipped', 'skipped'], ['failed', 'failed']])
    assert.equal(report[field], report.cases.filter(row => row.status === status).length);
  assert.equal(report.passed + report.skipped + report.failed, report.caseCount);
  const selected = [];
  for (const [name, methods] of [
    ['SearchDepartureFlowTest', ['nativeDateAndTimePickersProduceTheExpectedWireInstant',
      'cancellingEitherNativePickerPreservesTheAcceptedChoiceWithoutAnEdit',
      'aMissingLocalHourIsRejectedAndCanBeCorrectedWithoutReplacingTheChoice',
      'aRepeatedLocalHourNeverSilentlyChoosesOneOffset', 'invalidWireInputIsExplicitAndDoesNotInventAnotherDeparture']],
    ['SearchDepartureLayoutTest', [false, true].flatMap(dark => [320, 900].map(width =>
      `enlargedDateAndTimeFitBothResponsiveFormatsWithoutOverlap[dark-${dark}-width-${width}]`))],
    ['SearchCriteriaFlowTest', ['navigationRetainsOptionsAndBookingUsesTheCompletedSelection',
      'eachOptionChangeRemovesResultsAndRejectsThePreviousBookingAction']],
  ]) {
    const rows = report.cases.filter(row => row.className === 'be.sportgreenmoove.app.ui.' + name);
    assert.deepEqual(rows.map(row => row.name).sort(), methods.sort(), name);
    assert(rows.every(row => row.status === 'passed' && row.reason === null), name + ' must execute and pass');
    selected.push(...rows);
  }
  return selected;
}
