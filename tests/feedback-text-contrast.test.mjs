import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {parseDocument} from 'yaml';
import {XMLParser} from 'fast-xml-parser';
import {feedbackTextCases, feedbackTextFolder, validateFeedbackTextUnits, validateFeedbackTextCaptureFiles} from '../scripts/qa/feedback-text-evidence.mjs';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {feedbackTextProgress} from '../partner-portal/feedback-text-progress.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), read = file => readFileSync(resolve(root, file), 'utf8');
const main = 'android/app/src/main/java/be/sportgreenmoove/app/';
test('the split-fixture failure and preparation stops remain incomplete on the public progress site', () => {
  const folder = 'docs/release/evidence/feedback-layout-recheck-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file));
  const review = json('review.json'); assert.deepEqual(review.ordinary, {cases: 315, passed: 254, failed: 6, skipped: 55});
  assert.equal(review.inputSplitResolvedAllFailures, false); assert.equal(review.wideFailureNode, 'review.submission.error');
  assert.equal(review.newDiagnosticCompiled, true); assert.equal(review.newDiagnosticExecuted, false);
  for (const key of ['productSourceChanged', 'measurementsOrThresholdsChanged', 'nativeLayoutsAccepted',
    'physicalDeviceAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.acceptedScreenshots, []);
  for (const stage of ['failed', 'diagnostic']) assertRetainedSourceFiles(root, json(stage + '-source-files.json'));
  for (const [file, id, failedStep] of [['native-job.json', 125687356041, 'Run Android Compose UI tests'],
    ['web-job.json', 125687357144, 'Test isolated trip history access and paging'],
    ['team-draft-job.json', 125687356797, 'Install the selected device image before reserving storage']]) {
    const job = json(file); assert.equal(job.id, id); assert.equal(job.conclusion, 'failure');
    assert.equal(job.steps.find(step => step.name === failedStep).conclusion, 'failure');
  }
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(selection.sourceCommit, '6e4ef9721a838502bb279352914a73d951ef8e96');
  assert.equal(artifact.id, 13201140045); assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  for (const [member, hash] of Object.entries(selection.members))
    assert.equal(createHash('sha256').update(read(folder + member.split('/').at(-1))).digest('hex'), hash);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read(folder + 'TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['315', '6', '55']);
  const cases = suite.testcase.filter(row => row['@_classname'].endsWith('.FeedbackTextLayoutTest'));
  assert.equal(cases.length, 12); assert.equal(cases.filter(row => row.failure).length, 6);
  assert.equal(content.updates.filter(entry => entry.source === feedbackTextProgress.source).length, 1);
  assert.equal(feedbackTextProgress.source, folder + 'README.md'); assert.equal(feedbackTextProgress.flow, 'appearance');
  assert(!/BrowserStack|Firebase|Compose|Jetpack|Playwright|Android/.test(JSON.stringify(feedbackTextProgress)));
  assert.equal(content.flows.find(flow => flow.id === 'appearance').status, 'partial');
});
test('the original four layout failures and separate primary-copy failure cannot become passing evidence', () => {
  const folder = 'docs/release/evidence/feedback-layout-attempt-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file));
  const job = json('job.json'); assert.equal(job.id, 125676799265); assert.equal(job.conclusion, 'failure');
  assert.equal(job.run_id, 41562709680);
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(selection.sourceCommit, '0dce1ea8604cbf52b85fe8c16c1c7b3915027b03');
  assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit); assert.equal(artifact.id, 13198720403);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  for (const [member, hash] of Object.entries(selection.members))
    assert.equal(createHash('sha256').update(read(folder + member.split('/').at(-1))).digest('hex'), hash);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read(folder + 'TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['311', '4', '55']);
  const rows = suite.testcase.filter(row => row['@_classname'].endsWith('.FeedbackTextLayoutTest'));
  assert.equal(rows.length, 8);
  assert.equal(rows.filter(row => row.failure && row['@_name'].includes('[notices-')).length, 4);
  assert.equal(rows.filter(row => !row.failure && row['@_name'].includes('[ride-')).length, 4);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1});
  const observed = json('observed-failures.json');
  assert.equal(observed.replayFailure, 'primary-copy-booking-ui-response-loss');
  for (const key of ['nativeLayoutsAccepted', 'physicalDeviceAccepted', 'releaseAccepted']) assert.equal(observed[key], false);
  for (const stage of ['failed', 'candidate']) assertRetainedSourceFiles(root, json(stage + '-source-files.json'));
  const candidate = json('candidate-review.json'); assert.equal(candidate.caseCount, 12);
  assert.equal(candidate.nativeTestApkCompiled, true); assert.equal(candidate.nativeLayoutsExecuted, false);
  assert.equal(candidate.productSourcesChanged, false); assert.equal(candidate.overflowChecksRetained, true);
  assert.equal(candidate.physicalDeviceAccepted, false); assert.equal(candidate.releaseAccepted, false);
});
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
test('twelve layouts keep the input separate without changing themes, sizes or overflow requirements', () => {
  const suite = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.kt');
  const capture = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextCapture.kt');
  assert.equal(feedbackTextCases.length, 12);
  assert(suite.includes('else if (screen == "input")'));
  assert(suite.includes('"input" -> listOf("feedback.material-error")'));
  assert(suite.indexOf('retainFeedbackLayoutDiagnostics(compose, name, tags)') < suite.indexOf('val node = compose.onNodeWithTag(tag).assertIsDisplayed()'));
  const diagnostic = read('android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackLayoutDiagnostics.kt');
  for (const token of ['pre-assertion-layout-diagnostic-not-accepted-evidence', '.put("assertionsPassed", false)',
    'layout.didOverflowWidth', 'layout.didOverflowHeight', 'layout.layoutInput.constraints', 'printToString()',
    '"sgm-feedback-diagnostics"']) assert(diagnostic.includes(token));
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
  assert.equal(validateFeedbackTextCaptureFiles(directory).records.length, 12);
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
        'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackText*.kt',
        'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackLayoutDiagnostics.kt']) assert(paths.includes(path));
    }
    const steps = Object.values(workflow.jobs).flatMap(job => job.steps ?? []);
    assert.equal(steps.filter(step => step.run === 'node --test tests/feedback-text-contrast.test.mjs').length, 1);
    assert(steps.some(step => step.run === 'node --test tests/neutral-text-contrast.test.mjs'));
    assert(steps.some(step => step.run === 'node --test tests/accent-controls.test.mjs'));
  }
});
