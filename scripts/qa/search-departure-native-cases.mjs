import assert from 'node:assert/strict';

export const searchDepartureCandidate = '03b8d23bbdc0aa4e1c924a17d01eea7baea69410';
const ordinary = 'outputs/store-review-screenshots/';
const replay = 'outputs/local-ui-evidence/31c53c811db40113e924455179fd1834/';
export const searchDepartureArchiveMembers = Object.freeze({
  'ordinary-results.json': ordinary + 'ordinary-results.json',
  'ordinary-instrumentation.txt': ordinary + 'ordinary-instrumentation.txt',
  'ordinary-process.json': ordinary + 'ordinary-process.json',
  'native-suite-status.json': ordinary + 'native-suite-status.json',
  'disposable-store-restore.json': ordinary + 'disposable-store-restore.json',
  'chat-network/ui.json': replay + 'local-chat-network-ui.json',
  'chat-network/instrumentation.txt': replay + 'LocalChatNetworkFlowTest-instrumentation.txt',
  'chat-network/validation-before.json': replay + 'chat-network-validation-before.json',
  'chat-network/validation-after.json': replay + 'chat-network-validation-after.json',
  'chat-network/failure-cleanup-copy.json': replay + 'adb-pull-failure-cleanup.json',
});
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
