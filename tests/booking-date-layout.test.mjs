import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';

const root = resolve(import.meta.dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const native = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/';

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
  for (const value of ['useUnmergedTree = true', 'performScrollTo().assertIsDisplayed()', 'GetTextLayoutResult',
    'layouts.isNotEmpty() && layouts.none { it.hasVisualOverflow }', 'bounds.left >= viewport.left',
    'bounds.right <= viewport.right', 'bounds.top >= viewport.top', 'bounds.bottom <= viewport.bottom',
    'layout.layoutInput.style.color', 'color != Color.Unspecified', 'compositeOver(background)',
    'SgmColor.HeroStart else palette.bgCard', 'check(contrast >= 4.5)']) assert(suite.includes(value), value);
  assert(suite.indexOf('check(contrast >= 4.5)') < suite.indexOf('captureBookingDateViewport(compose'));
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
