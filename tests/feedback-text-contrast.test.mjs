import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {feedbackTextCases, feedbackTextFolder, validateFeedbackTextUnits, validateFeedbackTextCaptureFiles} from '../scripts/qa/feedback-text-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), read = file => readFileSync(resolve(root, file), 'utf8');
const main = 'android/app/src/main/java/be/sportgreenmoove/app/';
test('actual Kotlin feedback roles reproduce eighteen failures then pass all thirty measurements', () => {
  const result = validateFeedbackTextUnits(root);
  assert.deepEqual({...result, minimumTextContrast: 0}, {beforeCases: 28, originalFailures: 18, afterCases: 30,
    currentFailures: 0, minimumTextContrast: 0, nativeLayoutsExecuted: false, releaseAccepted: false});
  assert(result.minimumTextContrast >= 4.5);
});
test('the correction changes foreground roles without altering brand surfaces or interaction logic', () => {
  const sources = stage => JSON.parse(read(feedbackTextFolder + stage + '/source-files.json'));
  const old = sources('before'), current = sources('after');
  const archived = hash => read('docs/release/evidence/source-archive/' + hash + '.txt');
  for (const file of ['design/SgmColors.kt', 'design/SgmTheme.kt', 'ui/RuntimeNotice.kt',
    'ui/RideMonitorScreen.kt', 'ui/TripsActiveRideCard.kt', 'ui/ReviewCard.kt']) {
    const path = main + file; let corrected = archived(current[path]);
    if (file === 'design/SgmColors.kt') corrected = corrected.split('\n')
      .filter(line => !/^\s+(?:val text(?:Warning|Error): Color,|text(?:Warning|Error)\s+=)/.test(line)).join('\n');
    else if (file === 'design/SgmTheme.kt') corrected = corrected.split('\n').filter(line => !/^\s+onError =/.test(line))
      .join('\n').replaceAll('error = sgmColors.textError', 'error = SgmColor.Red');
    else corrected = corrected.replaceAll('Sgm.colors.textWarning', 'SgmColor.Orange')
      .replaceAll('Sgm.colors.textError', 'SgmColor.Red').replaceAll('Sgm.colors.textAccent', 'SgmColor.Green')
      .replace('internal fun RideStatusPill', 'private fun RideStatusPill');
    assert.equal(corrected, archived(old[path]), file);
  }
  const theme = read(main + 'design/SgmTheme.kt'); assert.equal(theme.split('error = sgmColors.textError').length - 1, 2);
  for (const role of ['onError = SgmColor.TextOnAccent', 'onError = SgmColor.TextOnGreen']) assert(theme.includes(role));
  for (const [file, role] of [['ui/RuntimeNotice.kt', 'Sgm.colors.textWarning else Sgm.colors.textAccent'],
    ['ui/RideMonitorScreen.kt', 'Sgm.colors.textWarning'], ['ui/TripsActiveRideCard.kt', 'Sgm.colors.textWarning'],
    ['ui/ReviewCard.kt', 'Sgm.colors.textError']]) assert(read(main + file).includes(role));
});
test('eight planned layouts exercise real components in two themes and fixed narrow/wide enlarged viewports', () => {
  const suite = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.kt');
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextCapture.kt');
  assert.equal(feedbackTextCases.length, 8);
  for (const required of ['RuntimeNotice(', 'ReviewCard(', 'ActiveRideEntryCard(', 'RideStatusPill(', 'OutlinedTextField(',
    'fontScale = 1.3f', '320, 700, 3f', '900, 600, 1f', 'hasVisualOverflow', 'ro.kernel.qemu']) assert(suite.includes(required));
  for (const forbidden of ['AndroidRuntime.create', 'FirebaseGateway', 'GoogleMap(', 'RideMonitorScreen(']) assert(!suite.includes(forbidden));
  for (const required of ['captureToImage()', 'device.takeScreenshot(window)', 'colors.size > 16', 'cp -n', 'sha256sum',
    'executed-feedback-components-not-full-app-or-physical']) assert(capture.includes(required));
  const shell = read('scripts/run-android-ui-tests-and-collect-screenshots.sh');
  assert.equal(shell.split('adb pull /sdcard/Download/sgm-feedback-text "$output_dir" || return 1').length - 1, 1);
  assert(shell.includes('Missing feedback text evidence:')); assert(shell.includes('for suffix in .png -window.png .json'));
  for (const file of [main + 'design/SgmColors.kt', main + 'design/SgmTheme.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.kt',
    'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextCapture.kt']) assert(read(file).split('\n').length < 300);
});
test('integrity checks reject missing, mismatched or broader-scope component records without inventing rendered acceptance', t => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-feedback-integrity-')); t.after(() => rmSync(directory, {recursive: true, force: true}));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  // Header-only data tests the validator, not actual rendered-image acceptance.
  const png = (width, height) => {const bytes = Buffer.alloc(2048); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
    bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes;};
  for (const name of feedbackTextCases) {
    const [screen, theme, format] = name.split('-'), [width, height, density] = format === 'phone' ? [320, 700, 3] : [900, 600, 1];
    const viewport = png(width * density, height * density), window = png(1080, 2400);
    writeFileSync(resolve(directory, name + '.png'), viewport); writeFileSync(resolve(directory, name + '-window.png'), window);
    writeFileSync(resolve(directory, name + '.json'), JSON.stringify({scope: 'executed-feedback-components-not-full-app-or-physical',
      case: name, screen, dark: theme === 'dark', widthDp: width, heightDp: height, density, fontScale: 1.3,
      physicalDevice: false, backendCalls: false, mapsRendered: false, productionWrites: false, capturedAtEpochMillis: 1,
      viewportSha256: sha(viewport), windowSha256: sha(window), completed: true}));
  }
  assert.equal(validateFeedbackTextCaptureFiles(directory).records.length, 8);
  const path = resolve(directory, feedbackTextCases[0] + '.json'), original = JSON.parse(readFileSync(path));
  for (const change of [r => r.physicalDevice = true, r => r.backendCalls = true, r => r.mapsRendered = true,
    r => r.productionWrites = true, r => r.fontScale = 1, r => r.viewportSha256 = '0'.repeat(64)]) {
    const altered = structuredClone(original); change(altered); writeFileSync(path, JSON.stringify(altered));
    assert.throws(() => validateFeedbackTextCaptureFiles(directory));
  }
});
test('the compiled plan cannot be promoted to a rendered, physical or complete-release result', t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-feedback-scope-')); t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, feedbackTextFolder); cpSync(resolve(root, feedbackTextFolder), folder, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temporary, 'docs/release/evidence/source-archive'));
  const original = JSON.parse(readFileSync(resolve(folder, 'review.json'))), originalHashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  for (const key of ['nativeLayoutsExecuted', 'physicalDeviceAccepted', 'fullAppAccessibilityAccepted', 'systemInsetsAccepted',
    'screenReaderAccepted', 'backendFlowAccepted', 'releaseAccepted']) {
    const bytes = JSON.stringify({...original, [key]: true}); writeFileSync(resolve(folder, 'review.json'), bytes);
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify({...originalHashes,
      'review.json': createHash('sha256').update(bytes).digest('hex')}));
    assert.throws(() => validateFeedbackTextUnits(temporary), new RegExp(key));
  }
});
test('both authoritative lanes run the new contract without removing earlier colour checks', () => {
  for (const file of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(read('.github/workflows/' + file)).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/feedback-text-contrast.test.mjs'));
    if (file === 'web-integration-smoke.yml') for (const event of ['push', 'pull_request']) {
      const paths = workflow.on[event].paths;
      for (const component of ['RuntimeNotice', 'RideMonitorScreen', 'TripsActiveRideCard', 'ReviewCard'])
        assert(paths.includes(main + 'ui/' + component + '.kt'));
      for (const path of [main + 'design/Sgm*.kt', 'scripts/qa/**', 'scripts/run-android-ui-tests-and-collect-screenshots.sh',
        'android/app/src/test/java/be/sportgreenmoove/app/design/SgmFeedbackContrastTest.kt',
        'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackText*.kt']) assert(paths.includes(path));
    }
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
    assert.equal(steps.filter(step => step.run === 'node --test tests/feedback-text-contrast.test.mjs').length, 1);
    assert(steps.some(step => step.run === 'node --test tests/neutral-text-contrast.test.mjs'));
    assert(steps.some(step => step.run === 'node --test tests/accent-controls.test.mjs'));
  }
});
