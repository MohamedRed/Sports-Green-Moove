import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {bookingDateCases, validateBookingDateAttempt} from './booking-date-attempt-evidence.mjs';
import {compareFeedbackViewportPixels} from './feedback-text-pixel-review.mjs';

export const bookingDateVisualFolder = 'docs/release/evidence/booking-date-visual-2026-11-03/';
export const bookingDatePublicCases = ['requests-scheduled-light-phone', 'requests-unknown-dark-wide',
  'trips-unknown-light-phone', 'trips-scheduled-dark-wide', 'payments-unknown-dark-phone', 'payments-scheduled-light-wide'];
const probes = ['completeWrappedDateKeepsEveryCharacter', 'verticallyClippedDateIsRejected',
  'ellipsizedDateIsRejected', 'nonWrappingOverflowIsRejected'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateBookingDateVisualReview(root) {
  const folder = resolve(root, bookingDateVisualFolder), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)); assertEvidenceBundleChecksums(folder);
  const review = json('review.json'), job = json('job.json'), artifact = json('artifact.json');
  const selection = json('selection.json'), hashes = json('artifact-sha256.json'), parity = json('source-parity.json');
  assert.equal(review.scope, 'reviewed-booking-date-components-not-transactions-or-whole-app-accessibility');
  assert.equal(review.sourceCommit, 'edcd1e98ff53db6a276ce474c8c739aced88f5a4');
  assert.equal(review.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41596840602');
  assert.equal(review.reviewedAt, '2026-11-03'); assert.equal(review.fontScale, 1.3);
  for (const key of ['reviewedViewports', 'dateCasesPassed', 'completeViewportCaptures']) assert.equal(review[key], 24);
  assert.equal(review.measurementCasesPassed, 4); assert.equal(review.reportedOverflowCases, 20);
  assert.equal(review.visualContentReviewed, true); assert.equal(review.originalFailuresRetained, true);
  assert.equal(review.measuredFrameChecksPassed, true); assert.deepEqual(review.publishedCases, bookingDatePublicCases);
  assert.equal(review.publishedCaptureKind, 'original-viewport');
  for (const key of ['comparisonWindowsPublished', 'mediaEdits', 'productionSourcesChanged', 'assertionThresholdReduced',
    'deadlineChanged', 'fallbackAdded', 'physicalDeviceAccepted', 'backendFlowAccepted', 'paymentAccepted', 'mapsAccepted',
    'screenReaderAccepted', 'systemInsetsAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.equal(job.id, 125786079517); assert.equal(job.run_id, 41596840602);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  for (const name of ['Run Android Compose UI tests', 'Upload Android instrumentation reports'])
    assert.equal(job.steps.find(step => step.name === name)?.conclusion, 'success');
  assert.equal(artifact.id, 13213584966); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, review.sourceCommit); assert.equal(artifact.size_in_bytes, 30275082);
  assert.equal(selection.originalArchiveBytes, artifact.size_in_bytes);
  assert.equal(selection.originalArchiveSha256, '1ce710e9ca6119b3fa4d40949b4d16727604f64b6fc2aa8fdfb07a604618c9ae');
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  const members = Object.fromEntries(bookingDateCases.flatMap(name => ['.png', '-window.png', '.json'].map(suffix =>
    ['outputs/store-review-screenshots/sgm-booking-dates/' + name + suffix, hashes['captures/' + name + suffix]])));
  for (const name of ['ordinary-results.json', 'ordinary-instrumentation.txt', 'native-suite-status.json', 'disposable-store-restore.json'])
    members['outputs/store-review-screenshots/' + name] = hashes[name];
  members['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'] = hashes['TEST-guarded-components.xml'];
  assert.deepEqual(selection.members, members); assert.equal(Object.keys(members).length, 77);
  assert.equal(parity.headCommit, review.sourceCommit); assert.equal(parity.checkoutCommit, 'e67ea427900fde177904b76e522bf2c0d5fc395e');
  assert.equal(parity.allSelectedFilesMatch, true); assert.equal(parity.allBuildInputsCompared, false);
  assert.equal(Object.keys(parity.sourceFiles).length, 12); assertRetainedSourceFiles(root, parity.sourceFiles);
  for (const [file, hash] of Object.entries(parity.sourceFiles)) {
    const bytes = readFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'));
    assert.equal(createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), parity.githubBlobShas[file]);
  }
  const first = validateBookingDateAttempt(root);
  const originalParity = JSON.parse(readFileSync(resolve(root, 'docs/release/evidence/booking-date-attempt-2026-11-03/source-parity.json')));
  for (const [file, hash] of Object.entries(parity.sourceFiles)) if (file.includes('/src/main/') || file.endsWith('/MeasuredTextAssertions.kt'))
    assert.equal(hash, originalParity.sourceFiles[file], 'No production or established measurement helper change');
  const suite = new XMLParser({ignoreAttributes: false}).parse(read('TEST-guarded-components.xml')).testsuite;
  assert.deepEqual(['tests', 'failures', 'errors', 'skipped'].map(key => suite['@_' + key]), ['345', '0', '0', '55']);
  for (const [type, names] of [['BookingDateLayoutTest', bookingDateCases.map(name => `bookingDateIsCompleteAndReadable[${name}]`)],
    ['BookingDateMeasurementTest', probes]]) {
    const rows = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.' + type);
    assert.deepEqual(rows.map(row => row['@_name']).sort(), [...names].sort());
    assert(rows.every(row => !['failure', 'error', 'skipped'].some(key => Object.hasOwn(row, key))));
  }
  const ordinary = json('ordinary-results.json');
  assert.deepEqual([ordinary.complete, ordinary.guardConfirmed, ordinary.caseCount, ordinary.passed, ordinary.skipped, ordinary.failed],
    [true, true, 345, 290, 55, 0]);
  assert.equal(ordinary.installationsRemainedBlocked, true); assert.equal(ordinary.physicalDeviceAccepted, false);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0});
  const restoration = json('disposable-store-restore.json'); assert.equal(restoration.restored, true); assert.equal(restoration.verified, true);
  const comparisons = json('pixel-comparisons.json'), overflow = [], contrasts = [];
  assert.deepEqual(comparisons.map(row => row.case), bookingDateCases);
  for (const name of bookingDateCases) {
    const marker = json('captures/' + name + '.json'), [screen, kind, theme, format] = name.split('-'), wide = format === 'wide';
    assert.equal(marker.scope, 'booking-date-components-not-transaction-or-physical-proof');
    assert.equal(marker.case, name); assert.equal(marker.screen, screen); assert.equal(marker.dateKind, kind); assert.equal(marker.dark, theme === 'dark');
    assert.deepEqual([marker.widthDp, marker.heightDp, marker.density, marker.fontScale], wide ? [900, 600, 1, 1.3] : [320, 700, 3, 1.3]);
    for (const key of ['completed', 'layoutAssertionsPassed']) assert.equal(marker[key], true);
    for (const key of ['physicalDevice', 'backendCalls', 'mapsRendered', 'productionWrites']) assert.equal(marker[key], false, key);
    assert(marker.capturedAtEpochMillis >= Date.parse(job.started_at) && marker.capturedAtEpochMillis <= Date.parse(job.completed_at));
    const label = (kind === 'scheduled' ? 'MER 18 NOV. · 18h45' : 'DATE À CONFIRMER · --h--') + (screen === 'payments' ? ' · 2 places' : '');
    const text = marker.text; assert.equal(text.dateLabel, label); assert.equal(text.case, name);
    assert.equal(text.layoutCount, 1); assert.equal(text.measuredTextFits, true); assert.equal(text.measuredLastLineEnd, label.length);
    assert(text.measuredLineCount >= 1 && text.measuredParagraphWidthPx === text.reportedWidthPx);
    assert(Math.ceil(text.measuredParagraphHeightPx) <= text.reportedHeightPx);
    assert(Number.isFinite(text.contrastRatio) && text.contrastRatio >= 4.5); contrasts.push(text.contrastRatio);
    if (text.reportedWidthOverflow) overflow.push(name);
    const viewport = read('captures/' + name + '.png'), window = read('captures/' + name + '-window.png');
    assert.equal(marker.viewportSha256, sha(viewport)); assert.equal(marker.windowSha256, sha(window));
    const observed = compareFeedbackViewportPixels(viewport, window, wide ? {left: 90, top: 900} : {left: 60, top: 150});
    assert.deepEqual(comparisons.find(row => row.case === name), {case: name, ...observed});
    assert.deepEqual([observed.width, observed.height, observed.windowWidth, observed.windowHeight], wide ? [900, 600, 1080, 2400] : [960, 2100, 1080, 2400]);
    assert.equal(observed.changedPixels, 0, name);
  }
  assert.deepEqual(overflow, bookingDateCases.filter(name => !first.passingCases.includes(name)));
  const checks = json('checks.json'); assert.equal(checks.headRefOid, review.sourceCommit); assert.equal(checks.statusCheckRollup.length, 32);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED' && ['SUCCESS', 'SKIPPED'].includes(row.conclusion)));
  assert.deepEqual(['SUCCESS', 'SKIPPED'].map(value => checks.statusCheckRollup.filter(row => row.conclusion === value).length), [24, 8]);
  const previousAppearance = json('previous-appearance.json'); assert.equal(previousAppearance.images.length, 20); assert.equal(previousAppearance.status, 'partial');
  return {...review, previousAppearance, minimumContrast: Math.min(...contrasts)};
}
