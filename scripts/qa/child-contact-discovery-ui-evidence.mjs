import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

const classes = ['ChildAccountLinkFlowTest', 'ChildEmergencyPermissionFlowTest', 'ChildRideEmergencyFlowTest'];
export function validateChildDiscoveryUiReport(report, source) {
  assert.equal(source.head, '3b386a023bd92ce66958e6a3d28c8fa64b97d370');
  assert.equal(source.runId, 40319003618); assert.equal(source.jobId, 121558809939);
  assert.equal(source.conclusion, 'failure'); assert.equal(source.scope, 'nine-child-components-with-failed-main-gate-not-phone-or-release-proof');
  for (const key of ['mockedGateway', 'mockedDialer']) assert.equal(source[key], true);
  for (const key of ['mainNativeCiPassed', 'physicalDevice', 'actualChildSignIn', 'invitationExecuted',
    'connectedBackend', 'dialerOpened', 'screenshotsAccepted', 'productionWrites']) assert.equal(source[key], false);
  assert.equal(report.complete, true); assert.equal(report.guardConfirmed, true);
  assert.deepEqual([report.caseCount, report.passed, report.skipped, report.failed], [224, 169, 54, 1]);
  assert.equal(report.productionWritesAccepted, false); assert.equal(report.physicalDeviceAccepted, false);
  const child = report.cases.filter(row => classes.some(name => row.className === 'be.sportgreenmoove.app.ui.' + name));
  assert.equal(child.length, 9); assert(child.every(row => row.status === 'passed'));
  assert.deepEqual(classes.map(name => child.filter(row => row.className.endsWith('.' + name)).length), [2, 2, 5]);
  assert(child.some(row => row.name === 'settingsDiscoversNoActiveRideWithoutReadingOrManagingAContact'));
  assert.deepEqual(report.cases.filter(row => row.status === 'failed').map(row => [row.className, row.name]),
    [['be.sportgreenmoove.app.ui.TripChangeFlowTest', 'refusalKeepsTheInitialTripWithoutCancellingTheBooking']]);
}
export function validateChildDiscoveryUiEvidence(root) {
  const folder = 'docs/release/evidence/child-contact-discovery-ui-2026-10-26/';
  const read = path => readFileSync(resolve(root, folder, path));
  const source = JSON.parse(read('source.json')), ordinary = JSON.parse(read('ordinary-results.json'));
  validateChildDiscoveryUiReport(ordinary, source); assertRetainedSourceFiles(root, source.sourceFiles);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('ordinary-tests.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 224); assert.equal(Number(suite['@_failures']), 1);
  assert.equal(JSON.parse(read('native-suite-status.json')).ordinaryTests, 1);
  const failure = read('failure.txt').toString();
  assert(failure.includes('java.lang.AssertionError: Failed waiting for PixelCopy!'));
  assert(failure.includes('LocalUiCapture.kt:20')); assert(failure.includes('TripChangeFlowTest.kt:154'));
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['source.json', 'ordinary-results.json', 'ordinary-tests.xml',
    'native-suite-status.json', 'failure.txt'].sort());
  for (const [path, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(path)).digest('hex'), hash);
}
