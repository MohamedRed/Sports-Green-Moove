import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {feedbackTextCases, validateFeedbackTextCaptureFiles, validateFeedbackTextUnits} from './feedback-text-evidence.mjs';
import {validateFeedbackPixelReview} from './feedback-text-pixel-review.mjs';

export const feedbackVisualFolder = 'docs/release/evidence/feedback-text-visual-2026-11-03/';
export const feedbackVisualPublicCases = ['notices-light-phone', 'notices-dark-wide', 'ride-light-phone', 'input-light-phone', 'input-dark-phone'];
export const feedbackOriginallyRejectedViewports = ['notices-dark-phone', 'ride-dark-phone', 'ride-dark-wide'];

export function validateFeedbackTextVisualReview(root) {
  const folder = resolve(root, feedbackVisualFolder), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file));
  assertEvidenceBundleChecksums(folder);
  const review = json('review.json'), job = json('job.json'), artifact = json('artifact.json');
  const selection = json('selection.json'), parity = json('source-parity.json'), hashes = json('artifact-sha256.json');
  assert.equal(review.scope, 'reviewed-feedback-components-not-whole-app-accessibility');
  assert.equal(review.sourceCommit, 'c6c3eb452c8b3f8e771c9ec827cffbf2b9a6661d');
  assert.equal(review.reviewedAt, '2026-11-03'); assert.equal(review.reviewedViewports, 12);
  assert.equal(review.fontScale, 1.3); assert.deepEqual(review.cases, feedbackTextCases);
  assert.deepEqual(review.publishedCases, feedbackVisualPublicCases); assert.equal(review.mediaEdits, false);
  assert.equal(review.publishedCaptureKind, 'original-viewport'); assert.equal(review.completeViewportCaptures, 9);
  assert.deepEqual(review.incompleteViewportCases, feedbackOriginallyRejectedViewports);
  assert.deepEqual(review.comparisonWindowCases, feedbackOriginallyRejectedViewports);
  assert.equal(review.comparisonWindowsPublished, false); assert.equal(review.viewportExportIssueResolved, false);
  assert.equal(review.layoutAssertionsPassed, 12); assert.equal(review.fallbackAdded, false);
  assert(review.publishedCases.every(name => !review.incompleteViewportCases.includes(name)));
  assert.equal(review.samplingRegressionsPassed, 2); assert.equal(review.mainNativeJobSucceeded, true);
  for (const key of ['physicalDeviceAccepted', 'backendFlowAccepted', 'mapsAccepted', 'screenReaderAccepted',
    'systemInsetsAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(job.id, 125732329925); assert.equal(job.run_id, 41579996852);
  assert.equal(job.name, 'Android native UI tests');
  assert.equal(review.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/' + job.run_id);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  for (const name of ['Compile app and tests before starting the disposable device', 'Run Android Compose UI tests',
    'Upload Android instrumentation reports']) assert.equal(job.steps.find(step => step.name === name)?.conclusion, 'success');
  assert.equal(artifact.id, 13206118999); assert.equal(artifact.name, 'android-connected-ui-test-results');
  assert.equal(artifact.workflow_run.id, job.run_id); assert.equal(artifact.workflow_run.head_sha, review.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(selection.originalArchiveSha256, '4432640e7a218eaa43a06b5b0b437fea9eabaf20d1421cec4fc5c6081134a3a9');
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  const members = Object.fromEntries(feedbackTextCases.flatMap(name => ['.png', '-window.png', '.json'].map(suffix =>
    ['outputs/store-review-screenshots/sgm-feedback-text/' + name + suffix, hashes['captures/' + name + suffix]])));
  for (const [member, file] of [['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml', 'TEST-guarded-components.xml'],
    ['outputs/store-review-screenshots/native-suite-status.json', 'native-suite-status.json'],
    ['outputs/store-review-screenshots/ordinary-results.json', 'ordinary-results.json']]) members[member] = hashes[file];
  assert.deepEqual(selection.members, members);
  for (const [member, hash] of Object.entries(members)) assert.match(hash, /^[a-f0-9]{64}$/, member);
  assert.equal(parity.headCommit, review.sourceCommit);
  assert.equal(parity.checkoutCommit, 'e8b91992447bb5fe4544c4daf56c2704cb38e70b');
  assert.equal(parity.allSelectedFilesMatch, true); assert.equal(parity.allBuildInputsCompared, false);
  assert.deepEqual(review.sourceFiles, parity.sourceFiles); assert.equal(Object.keys(parity.sourceFiles).length, 12);
  assertRetainedSourceFiles(root, review.sourceFiles);
  for (const [file, hash] of Object.entries(parity.sourceFiles)) {
    const bytes = readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'));
    assert.equal(createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), parity.githubBlobShas[file]);
  }
  const suite = new XMLParser({ignoreAttributes: false}).parse(read('TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_errors'], suite['@_skipped']], ['317', '0', '0', '55']);
  const rows = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.FeedbackTextLayoutTest');
  assert.deepEqual(rows.map(row => row['@_name']).sort(), feedbackTextCases
    .map(name => 'feedbackTextFitsActualComponents[' + name + ']').sort());
  const sampling = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.FeedbackCaptureSamplingTest');
  assert.deepEqual(sampling.map(row => row['@_name']).sort(),
    ['aMonochromeImageIsStillRejected', 'detailBetweenCoarseGridPointsIsNotRejectedAsBlank']);
  assert([...rows, ...sampling].every(row => !['failure', 'error', 'skipped'].some(key => Object.hasOwn(row, key))));
  const ordinary = json('ordinary-results.json');
  assert.deepEqual([ordinary.complete, ordinary.guardConfirmed, ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed],
    [true, true, 317, 262, 55, 0]);
  assert.equal(ordinary.installationsRemainedBlocked, true); assert.equal(ordinary.physicalDeviceAccepted, false);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const captures = validateFeedbackTextCaptureFiles(resolve(folder, 'captures'));
  for (const marker of captures.records) {
    assert(marker.capturedAtEpochMillis >= Date.parse(job.started_at));
    assert(marker.capturedAtEpochMillis <= Date.parse(job.completed_at));
  }
  const checks = json('checks.json'); assert.equal(checks.headRefOid, review.sourceCommit);
  assert.equal(checks.statusCheckRollup.length, 32);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === 'SUCCESS').length, 24);
  assert.equal(checks.statusCheckRollup.filter(row => row.conclusion === 'SKIPPED').length, 8);
  const previous = json('previous-publication.json');
  assert.equal(previous.siteVersion, 325);
  assert.equal(previous.publicDataSha256, 'e59ecc256cde7997fcf3fe188c013e2bfb1ab98ed621dc2d0b3708962a5ef573');
  assert.equal(previous.allFlowFingerprint, 'b5772455f74ec402c5b25acfa5736917c7e8db4a3332725a416868d18cacadd8');
  assert.equal(previous.appearanceFlow.images.length, 15); assert.equal(previous.appearanceFlow.checkedAt, '2026-10-30');
  assert.equal(createHash('sha256').update(read('review.json')).digest('hex'), hashes['review.json']);
  const correction = validateFeedbackPixelReview(folder, feedbackTextCases, feedbackOriginallyRejectedViewports);
  return {...review, completeViewportCaptures: correction.completeViewportCaptures,
    incompleteViewportCases: correction.incompleteViewportCases, initialCompleteViewportCaptures: review.completeViewportCaptures,
    initialIncompleteViewportCases: review.incompleteViewportCases, correction,
    previousAppearance: previous.appearanceFlow, measurements: validateFeedbackTextUnits(root)};
}
