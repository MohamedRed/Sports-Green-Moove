import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const bookingDateAttemptFolder = 'docs/release/evidence/booking-date-attempt-2026-11-03/';
export const bookingDateCases = ['requests', 'trips', 'payments'].flatMap(screen => ['scheduled', 'unknown'].flatMap(kind =>
  ['light', 'dark'].flatMap(theme => ['phone', 'wide'].map(format => `${screen}-${kind}-${theme}-${format}`))));

export function validateBookingDateAttempt(root) {
  const folder = resolve(root, bookingDateAttemptFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)); assertEvidenceBundleChecksums(folder);
  const result = json('analysis.json'), job = json('job.json'), artifact = json('artifact.json');
  const hashes = json('artifact-sha256.json'), selection = json('selection.json'), parity = json('source-parity.json');
  assert.equal(result.scope, 'first-booking-date-native-attempt-not-accepted-visual-evidence');
  assert.equal(result.sourceCommit, '549c547209439bda0ec9a87b4776eb5ee0698ac5');
  assert.equal(result.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41590992650');
  assert.deepEqual(result.ordinary, {cases: 341, passed: 266, skipped: 55, failed: 20});
  assert.deepEqual(result.dateCases, {executed: 24, passed: 4, failed: 20});
  const passing = ['scheduled', 'unknown'].flatMap(kind => ['light', 'dark'].map(theme => `payments-${kind}-${theme}-phone`));
  assert.deepEqual(result.passingCases, passing); assert.equal(result.failedCondition, 'incomplete date text layout');
  assert.equal(result.failedLine, 76); assert.equal(result.captureSource, 'partial-components-only');
  assert.equal(result.publishedCaptures, 0); assert.equal(result.originalFailuresRetained, true);
  assert.equal(result.candidateUsesExistingMeasuredTextAssertion, true);
  assert.equal(result.candidateMeasurementCasesPlanned, 4);
  assert.equal(result.candidateMeasurementCasesExecuted, 0); assert.equal(result.candidateDateCasesExecuted, 0);
  for (const key of ['allDatesAccepted', 'rootCauseConfirmedForDateCases', 'productionSourcesChanged',
    'assertionThresholdReduced', 'deadlineChanged', 'fallbackAdded', 'physicalDeviceAccepted', 'releaseAccepted'])
    assert.equal(result[key], false, key);
  assert.equal(job.id, 125767439935); assert.equal(job.run_id, 41590992650);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(step => step.name === 'Run Android Compose UI tests')?.conclusion, 'failure');
  assert.equal(artifact.id, 13210639271); assert.equal(artifact.workflow_run.head_sha, result.sourceCommit);
  assert.equal(artifact.size_in_bytes, 30228420); assert.equal(selection.originalArchiveBytes, artifact.size_in_bytes);
  assert.equal(selection.originalArchiveSha256, '7b1b117306e12378a3c2d71ae1bb763bdc83cf67bde2fd45a113cfd3e1f3c33b');
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  const suite = new XMLParser({ignoreAttributes: false}).parse(bytes('TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['341', '20', '55']);
  const cases = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.BookingDateLayoutTest');
  assert.deepEqual(cases.map(row => row['@_name']).sort(), bookingDateCases.map(name => `bookingDateIsCompleteAndReadable[${name}]`).sort());
  assert.deepEqual(cases.filter(row => !row.failure && !row.error && !row.skipped).map(row => row['@_name']).sort(),
    passing.map(name => `bookingDateIsCompleteAndReadable[${name}]`).sort());
  const controlled = suite.testcase.find(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.BookingFeedbackLayoutTest' &&
    row['@_name'] === 'reconstructedSemanticsCannotTurnAParentWidthIntoAClippedLabelClaim');
  assert(controlled && !controlled.failure && !controlled.error && !controlled.skipped);
  const original = bytes('ordinary-instrumentation.txt').toString();
  assert.equal(new Set([...original.matchAll(/: ([\w-]+): incomplete date text layout/g)].map(match => match[1])).size, 20);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 0});
  const probe = json('known-width-probe.json');
  assert.deepEqual([probe.measuredWidthPx, probe.reportedParagraphWidthPx, probe.remeasuredParagraphWidthPx], [317, 734, 317]);
  assert.equal(probe.reportedWidthOverflow, true); assert.equal(probe.reportedHeightOverflow, false);
  assert.equal(probe.wholeLabelFitsMeasuredFrame, true);
  for (const name of passing) {
    const marker = json('partial-captures/' + name + '.json');
    assert.equal(marker.case, name); assert.equal(marker.completed, true); assert.equal(marker.fontScale, 1.3);
    assert.equal(marker.physicalDevice, false); assert.equal(marker.backendCalls, false);
    for (const [suffix, key] of [['.png', 'viewportSha256'], ['-window.png', 'windowSha256']])
      assert.equal(marker[key], hashes['partial-captures/' + name + suffix]);
  }
  const members = Object.fromEntries(['ordinary-instrumentation.txt', 'ordinary-results.json', 'native-suite-status.json',
    'disposable-store-restore.json'].map(name => ['outputs/store-review-screenshots/' + name, hashes[name]]));
  members['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'] = hashes['TEST-guarded-components.xml'];
  members['outputs/store-review-screenshots/partial-components/sgm-booking-feedback/booking-feedback-width-probe.json'] = hashes['known-width-probe.json'];
  for (const name of passing) for (const suffix of ['.png', '-window.png', '.json'])
    members['outputs/store-review-screenshots/partial-components/sgm-booking-dates/' + name + suffix] = hashes['partial-captures/' + name + suffix];
  assert.deepEqual(selection.members, members);
  assert.equal(parity.headCommit, result.sourceCommit); assert.equal(parity.checkoutCommit, 'dda18c64ce6118d2d3aa556d2e7f67ff56c5b95a');
  assert.equal(parity.allSelectedFilesMatch, true); assert.equal(parity.allBuildInputsCompared, false);
  assert.equal(Object.keys(parity.sourceFiles).length, 11); assertRetainedSourceFiles(root, parity.sourceFiles);
  for (const [file, hash] of Object.entries(parity.sourceFiles)) {
    const source = readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'));
    assert.equal(createHash('sha1').update('blob ' + source.length + '\0').update(source).digest('hex'), parity.githubBlobShas[file]);
  }
  const checks = json('checks.json'); assert.equal(checks.headRefOid, result.sourceCommit);
  assert.equal(checks.statusCheckRollup.length, 32);
  assert.deepEqual(['SUCCESS', 'SKIPPED', 'FAILURE'].map(value => checks.statusCheckRollup.filter(row => row.conclusion === value).length), [23, 8, 1]);
  return result;
}
