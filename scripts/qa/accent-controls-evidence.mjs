import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {imageSize} from 'image-size';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {verifySessionRestorationRecords} from './session-restoration-records.mjs';

export const accentControlsFolder = 'docs/release/evidence/accent-controls-phone-2026-10-30/';
export const accentControlPhases = ['home', 'search-light', 'search-dark', 'trips-dark', 'rewards-dark', 'rewards-light', 'signed-out'];
export const accentControlPublicPhases = ['search-light', 'search-dark', 'trips-dark', 'rewards-dark', 'rewards-light'];

export function validateAccentControlEvidence(root) {
  const folder = resolve(root, accentControlsFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), sha = value => createHash('sha256').update(value).digest('hex');
  assertEvidenceBundleChecksums(folder);
  const parser = new XMLParser({ignoreAttributes: false}), suites = {};
  for (const [stage, file, count, failures] of [['before', 'contrast-failed.xml', 18, 11], ['after', 'contrast-passed.xml', 20, 0]]) {
    const suite = parser.parse(bytes(stage + '/' + file)).testsuite; suites[stage] = suite;
    assert.equal(suite['@_tests'], String(count)); assert.equal(suite['@_failures'], String(failures));
    assert.equal(suite['@_errors'], '0'); assert.equal(suite['@_skipped'], '0'); assert.equal(suite.testcase.length, count);
    assert(suite.testcase.every(row => !['error', 'skipped'].some(key => Object.hasOwn(row, key))));
    const actualFailures = suite.testcase.filter(row => Object.hasOwn(row, 'failure'));
    assert.equal(actualFailures.length, failures);
    assert(actualFailures.every(row => row.failure['@_type'] === 'java.lang.AssertionError'));
    const ratios = suite['system-out'].trim().split('\n').map(line => JSON.parse(line));
    assert.equal(ratios.length, count);
    assert.deepEqual(suite.testcase.map(row => row['@_name']).sort(), ratios
      .map(row => 'roleMeetsItsContrastThreshold[' + row.case + ']').sort());
    assert(ratios.every(row => Number.isFinite(row.contrastRatio) && row.minimum === (row.case.endsWith('-icon') ? 3 : 4.5)));
    assert.equal(ratios.filter(row => row.contrastRatio < row.minimum).length, failures);
    assertRetainedSourceFiles(root, json(stage + '/source-sha256.json'));
  }
  const expected = ['light', 'dark'].flatMap(mode => ['app', 'surface', 'card', 'elevated', 'input'].map(surface => mode + '-accent-text-' + surface))
    .concat(['green', 'orange', 'green-light', 'orange-light'].map(color => 'on-' + color + '-text'),
      ['on-green-icon', 'on-orange-icon', 'hero-start-text', 'hero-end-text']);
  const measurements = suites.after['system-out'].trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(suites.before.testcase.map(row => row['@_name']).sort(), expected.map(name => 'roleMeetsItsContrastThreshold[' + name + ']').sort());
  assert.deepEqual(measurements.map(row => row.case).sort(), [...expected, 'material-light-primary', 'material-dark-primary'].sort());
  const review = json('review.json'), report = json('records/results.json'), baseline = json('records/baseline.json');
  assert.equal(review.scope, 'physical-session-visual-accent-controls-not-full-accessibility-or-payment');
  assert.equal(review.reviewedAt, '2026-10-30'); assert.equal(review.projectId, 'demo-sgm-local-qa');
  assert.equal(review.runId, 'bc508ae0a4d7abf8284bb5372e5468b0'); assert.equal(report.runId, review.runId);
  assert.equal(review.device.model, 'Google Pixel 9 Pro'); assert.equal(review.device.androidVersion, '15.0');
  assert.equal(review.device.physicalDevice, true); assert.equal(review.actualUiFlowsExecuted, true);
  for (const key of ['visualOverlapObserved', 'nativeScreenshotExports', 'withdrawalInvoked', 'realPaymentExercised',
    'productionWrites', 'iosUiExecuted', 'screenReaderVerified', 'fullAppAccessibilityAccepted', 'gradientContrastAccepted',
    'warningErrorTextAccepted', 'releaseAccepted', 'preparationFailuresAcceptedAsProductFailures']) assert.equal(review[key], false, key);
  assert.equal(review.mapRequests, 0); assert.deepEqual(review.phases, accentControlPhases);
  assert.deepEqual(review.published, accentControlPublicPhases);
  assert.deepEqual(review.helperScope, {ports: [5001, 8080, 9000, 9099], forceLocal: false, requestLogging: false,
    aliasEnabled: false, invitationPagePortEnabled: false});
  assert.equal(review.apk.sha256, 'd0e3daa86874e6f0d2aa6f4e8765dc820c1dc0062e501de0d62f7f0cdad6a5a2');
  assert.equal(review.apk.packageId, 'be.sportgreenmoove.app.local');
  assert.equal(review.apk.sourceHead, '753f0a42f0d62e81caa316b979b9a256c81e1751');
  assert.equal(review.apk.cleanCheckoutAttested, false); assert.equal(review.apk.workingTreeSourcesRetained, true);
  assert.equal(review.apk.installedBytesIndependentlyVerified, false);
  assert.equal(report.projectId, review.projectId); assert.equal(report.completed, true); assert.equal(report.failure, false);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  for (const key of ['physicalUiProven', 'productionWrites', 'realPaymentExercised']) assert.equal(report[key], false);
  assert.equal(report.providerRequests, 0); assertRetainedSourceFiles(root, report.sourceFiles);
  assert.deepEqual(baseline.claims.find(row => row.uid === 'sgm-qa-parent').claims.roleKeys, ['parent']);
  assert.deepEqual(report.checkpoints.map(row => row.phase), ['before', ...accentControlPhases]);
  for (const phase of ['before', ...accentControlPhases]) {
    const record = json('records/' + phase + '.json'); assert.equal(record.runId, report.runId);
    assert.equal(record.projectId, review.projectId); assert.equal(record.phase, phase);
    const isolation = verifySessionRestorationRecords(baseline, record.state);
    assert.deepEqual(record.isolation, isolation);
    assert.deepEqual(report.checkpoints.find(row => row.phase === phase), {phase, recordedAt: record.recordedAt, isolation});
  }
  for (const phase of accentControlPhases) {
    const capture = json('captures/' + phase + '-capture.json'); assert.equal(capture.phase, phase);
    assert.equal(capture.scope, 'unscaled-session-window-crop-not-native-export');
    assert.equal(capture.rescaled, false); assert.equal(capture.redacted, false);
    const original = bytes('captures/' + phase + '-session.jpg'), cropped = bytes('captures/' + phase + '.png');
    assert.equal(sha(original), capture.original.sha256); assert.equal(sha(cropped), capture.crop.sha256);
    assert.deepEqual([imageSize(original).width, imageSize(original).height], [1200, 596]);
    assert.deepEqual([imageSize(cropped).width, imageSize(cropped).height], [196, 439]);
    assert.deepEqual([capture.crop.left, capture.crop.top, capture.crop.width, capture.crop.height], [486, 108, 196, 439]);
    assert(Date.parse(capture.capturedAt) <= Date.parse(json('records/' + phase + '.json').recordedAt));
  }
  const disposal = json('disposal.json'), phone = json('phone-disposal.json'), uninstall = json('uninstall-observation.json');
  for (const key of ['privateSessionAbsent', 'runtimeDirectoryAbsent', 'helperDirectoryAbsent']) assert.equal(disposal[key], true);
  assert.deepEqual(disposal.endpoints, {host: '127.0.0.1', ports: [5001, 8080, 9000, 9099, 59093], closed: true});
  for (const key of ['sessionEnded', 'uploadedAppsDashboardObserved', 'uninstallAcknowledged', 'hostClipboardRestored', 'sourceCredentialMasked'])
    assert.equal(phone[key], true);
  assert.equal(phone.independentPackageAbsenceProven, false); assert.equal(phone.devicePolicyChanged, false);
  assert.equal(uninstall.providerAcknowledgement, 'Succesfully uninstalled your app(s)!');
  assert.equal(uninstall.androidHomeObserved, true); assert.equal(uninstall.independentPackageAbsenceProven, false);
  const constructor = parser.parse(bytes('preparation/constructor-failed.xml')).testsuite;
  assert.equal(constructor['@_tests'], '18'); assert.equal(constructor['@_failures'], '18');
  const preparation = json('preparation/observer-results.json');
  assert.equal(preparation.completed, false); assert.equal(preparation.failure, true); assert.deepEqual(preparation.checkpoints, []);
  return {beforeCases: 18, beforeFailures: 11, afterCases: 20, afterFailures: 0, phoneCheckpoints: 8,
    reviewedCaptures: 7, publicCaptures: 5, minimumTextContrast: Math.min(...measurements.filter(row => row.minimum === 4.5).map(row => row.contrastRatio)),
    allFlowRecordsUnchanged: true, fullAppAccessibilityAccepted: false, releaseAccepted: false};
}
