import assert from 'node:assert/strict';
import {readFileSync, cpSync, mkdtempSync, writeFileSync, rmSync, symlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {PNG} from 'pngjs';
import {bookingDateAttemptFolder, validateBookingDateAttempt} from '../scripts/qa/booking-date-attempt-evidence.mjs';
import {bookingDateVisualFolder, bookingDatePublicCases, validateBookingDateVisualReview} from '../scripts/qa/booking-date-visual-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {bookingDateProgress} from '../partner-portal/booking-date-attempt.mjs';
import {bookingDateVisualProgress} from '../partner-portal/booking-date-visual-flow.mjs';
import {validateBookingDateAppearance} from '../partner-portal/booking-date-appearance-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const native = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';

test('the first incomplete note is retained while only separately reviewed original date images enter the gallery', () => {
  assert(content.updates.includes(bookingDateProgress));
  assert.equal(bookingDateProgress.source, bookingDateAttemptFolder + 'README.md');
  const appearance = content.flows.find(flow => flow.id === 'appearance');
  assert.equal(appearance.status, 'partial'); assert.equal(appearance.images.length, 26);
  assert(content.updates.includes(bookingDateVisualProgress));
  assert(content.updates.indexOf(bookingDateVisualProgress) < content.updates.indexOf(bookingDateProgress));
  assert.equal(bookingDateVisualProgress.source, bookingDateVisualFolder + 'README.md');
  const prior = validateBookingDateAppearance(root, appearance, captures);
  assert.equal(prior.images.length, 20); assert(prior.remaining.includes('dates des réservations'));
  assert(!appearance.remaining.includes('dates des réservations'));
  for (const image of appearance.images.filter(image => image.file.startsWith('booking-date-')))
    assert(captures[image.file].startsWith(bookingDateVisualFolder + 'captures/'));
  assert.doesNotMatch(bookingDateProgress.title + bookingDateProgress.text, /BrowserStack|Firebase|SDK|APK|CI|Semantics/);
  assert.doesNotMatch(bookingDateVisualProgress.title + bookingDateVisualProgress.text, /BrowserStack|Firebase|SDK|APK|CI|Semantics/);
});

test('the completed source-bound date review proves all 24 original viewports and four measurement regressions', () => {
  const review = validateBookingDateVisualReview(root);
  assert.equal(review.dateCasesPassed, 24); assert.equal(review.measurementCasesPassed, 4);
  assert.equal(review.reportedOverflowCases, 20); assert.equal(review.completeViewportCaptures, 24);
  assert.deepEqual(review.publishedCases, bookingDatePublicCases); assert(review.minimumContrast >= 4.5);
  assert.equal(review.productionSourcesChanged, false); assert.equal(review.releaseAccepted, false);
});

test('date visual proof rejects widened claims, comparison windows, missing cases and modified original pixels', t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-booking-date-visual-negative-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, bookingDateVisualFolder); cpSync(resolve(root, bookingDateVisualFolder), folder, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temporary, 'docs/release/evidence/source-archive'));
  symlinkSync(resolve(root, bookingDateAttemptFolder), resolve(temporary, bookingDateAttemptFolder.replace(/\/$/, '')));
  const readJson = name => JSON.parse(readFileSync(resolve(folder, name)));
  const original = readJson('review.json'), originalHashes = readJson('artifact-sha256.json');
  const replace = (name, bytes) => {
    writeFileSync(resolve(folder, name), bytes);
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify({...originalHashes,
      [name]: createHash('sha256').update(bytes).digest('hex')}));
  };
  for (const key of ['physicalDeviceAccepted', 'backendFlowAccepted', 'paymentAccepted', 'mapsAccepted', 'screenReaderAccepted',
    'systemInsetsAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted', 'mediaEdits', 'comparisonWindowsPublished',
    'productionSourcesChanged', 'assertionThresholdReduced', 'deadlineChanged', 'fallbackAdded']) {
    replace('review.json', JSON.stringify({...original, [key]: true}));
    assert.throws(() => validateBookingDateVisualReview(temporary), new RegExp(key));
  }
  for (const change of [{dateCasesPassed: 23}, {measurementCasesPassed: 3}, {publishedCaptureKind: 'window'},
    {publishedCases: bookingDatePublicCases.slice(1)}]) {
    replace('review.json', JSON.stringify({...original, ...change}));
    assert.throws(() => validateBookingDateVisualReview(temporary), {code: 'ERR_ASSERTION'});
  }
  writeFileSync(resolve(folder, 'review.json'), readFileSync(resolve(root, bookingDateVisualFolder, 'review.json')));
  writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(originalHashes));
  const name = 'captures/requests-scheduled-light-phone.png';
  const image = PNG.sync.read(readFileSync(resolve(folder, name))); image.data[0] ^= 1;
  replace(name, PNG.sync.write(image));
  assert.throws(() => validateBookingDateVisualReview(temporary), {code: 'ERR_ASSERTION'});
});

test('the first native run retains twenty rejected date cases and four unaccepted partial capture triples', () => {
  const result = validateBookingDateAttempt(root);
  assert.deepEqual(result.dateCases, {executed: 24, passed: 4, failed: 20});
  assert.equal(result.publishedCaptures, 0); assert.equal(result.candidateDateCasesExecuted, 0);
});

test('the first date attempt cannot accept a replay, a root cause, partial gallery images or release readiness', t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-booking-date-negative-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, bookingDateAttemptFolder); cpSync(resolve(root, bookingDateAttemptFolder), folder, {recursive: true});
  const original = JSON.parse(readFileSync(resolve(folder, 'analysis.json')));
  const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  for (const change of [{allDatesAccepted: true}, {rootCauseConfirmedForDateCases: true}, {physicalDeviceAccepted: true},
    {releaseAccepted: true}, {publishedCaptures: 1}, {candidateDateCasesExecuted: 24}, {candidateMeasurementCasesExecuted: 4}]) {
    const value = JSON.stringify({...original, ...change}); writeFileSync(resolve(folder, 'analysis.json'), value);
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify({...hashes,
      'analysis.json': createHash('sha256').update(value).digest('hex')}));
    assert.throws(() => validateBookingDateAttempt(temporary), {code: 'ERR_ASSERTION'});
  }
});

test('booking dates cover actual request, trip and payment components with both existing date states', () => {
  const suite = read(native + 'BookingDateLayoutTest.kt');
  for (const value of ['BookingRequestsList(', 'TripsCard(', 'PaymentsScreen(', '"requests", "trips", "payments"',
    '"scheduled", "unknown"', 'listOf(false, true)', '320, 700, 3f', '900, 600, 1f', 'fontScale = 1.3f',
    '"MER 18 NOV."', '"DATE À CONFIRMER"', '"--h--"', '" · 2 places"', 'ro.kernel.qemu']) assert(suite.includes(value), value);
  for (const value of ['AndroidRuntime.create', 'FirebaseAndroidGateway', 'GoogleMap(', 'onPay.invoke', 'Thread.sleep', 'retry('])
    assert(!suite.includes(value), value);
});

test('date completeness, actual text contrast and viewport bounds must pass before capture acceptance', () => {
  const suite = read(native + 'BookingDateLayoutTest.kt');
  for (const value of ['useUnmergedTree = true', 'performScrollTo().assertIsDisplayed()', 'reportedTextLayout(node)',
    'assertMeasuredTextFits(reported)', 'reported.layoutInput.text.text == label', 'bounds.left >= viewport.left',
    'bounds.right <= viewport.right', 'bounds.top >= viewport.top', 'bounds.bottom <= viewport.bottom',
    'reported.layoutInput.style.color', 'color != Color.Unspecified', 'compositeOver(background)',
    'SgmColor.HeroStart else palette.bgCard', 'check(contrast >= 4.5)']) assert(suite.includes(value), value);
  assert(suite.indexOf('check(contrast >= 4.5)') < suite.indexOf('captureBookingDateViewport(compose'));
  assert(suite.indexOf('SGM_BOOKING_DATE_REPORTED') < suite.indexOf('assertMeasuredTextFits(reported)'));
  const measured = read(native + 'MeasuredTextAssertions.kt');
  for (const value of ['Constraints(maxWidth = reported.size.width)', '!measured.didExceedMaxLines',
    'ceil(measured.height).toInt() <= reported.size.height', 'input.text.length, measured.getLineEnd',
    'measured.getLineLeft(line) >= 0f', 'measured.getLineRight(line) <= reported.size.width']) assert(measured.includes(value), value);
  const probes = read(native + 'BookingDateMeasurementTest.kt');
  for (const value of ['completeWrappedDateKeepsEveryCharacter', 'verticallyClippedDateIsRejected',
    'ellipsizedDateIsRejected', 'nonWrappingOverflowIsRejected']) assert(probes.includes(value));
  assert.equal(probes.split('assertThrows(AssertionError::class.java)').length - 1, 3);
});

test('captures use original images, fixed dimensions and strict shared export without transaction claims', () => {
  const capture = read(native + 'BookingDateCapture.kt');
  for (const value of ['captureToImage()', 'device.takeScreenshot(window)', 'check(!image.exists())',
    'check(!window.exists())', 'check(!record.exists())', 'bitmap.width ==', 'bitmap.height ==',
    'requireFeedbackImageHasVariation(bitmap)', 'viewportSha256', 'windowSha256', 'layoutAssertionsPassed',
    '"backendCalls", false', '"mapsRendered", false', '"physicalDevice", false', '"productionWrites", false',
    'booking-date-components-not-transaction-or-physical-proof', '"sgm-booking-dates"']) assert(capture.includes(value), value);
  const shared = read(native + 'FeedbackTextCapture.kt');
  for (const value of ['"sgm-booking-dates"', 'cp -n', 'sha256sum', 'colors.size > 16']) assert(shared.includes(value));
  assert(!capture.includes('retry')); assert(!capture.includes('Bitmap.createBitmap'));
});

test('normal primary collection requires every one of the 72 date artifacts and retains partial failures separately', () => {
  const shell = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert.equal(shell.split('adb pull /sdcard/Download/sgm-booking-dates "$output_dir" || return 1').length - 1, 1);
  for (const value of ['for screen in requests trips payments', 'for kind in scheduled unknown',
    'for theme in light dark', 'for format in phone wide', 'for suffix in .png -window.png .json',
    'Missing booking date evidence:']) assert(shell.includes(value), value);
  assert(shell.slice(shell.indexOf('if [[ "$test_status" -ne 0 ]]')).includes('sgm-booking-dates'));
  for (const file of ['BookingDateCapture.kt', 'BookingDateLayoutTest.kt', 'FeedbackTextCapture.kt'])
    assert(read(native + file).split('\n').length < 300);
  assert(shell.split('\n').length < 300);
});

test('native and web gates keep existing contrast commands and include new date contracts and change triggers', () => {
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + name)).toJS();
    for (const event of ['pull_request', 'push']) {
      const paths = workflow.on[event].paths;
      assert.equal(paths.filter(path => path === 'tests/booking-date-layout.test.mjs').length, 1);
      assert(paths.includes('android/**') || paths.includes(native + 'BookingDate*.kt'));
    }
    const commands = Object.values(workflow.jobs).flatMap(job => job.steps ?? []).map(step => step.run);
    assert(commands.includes('node --test tests/booking-date-layout.test.mjs'));
    assert(commands.includes('node --test tests/feedback-text-contrast.test.mjs'));
  }
});
