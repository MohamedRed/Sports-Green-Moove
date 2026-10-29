import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';
import {assertInstrumentationPassed} from './android-instrumentation-result.mjs';

export const reviewRecoveryFolder = 'docs/release/evidence/review-submission-recovery-2026-10-29/';
export const recoveryCaptureIds = ['failed', 'recovered', 'large-text'];
export function assertReviewRecovery({summary, service, device, disposal, units}) {
  assert.equal(summary.scope, 'isolated-review-submission-recovery-components-and-callables-not-phone');
  assert.equal(summary.nativeComponentCases, 11); assert.equal(summary.newNativeCases, 2);
  assert.equal(summary.backendUnitCases, 547); assert.equal(summary.implementationUncommittedAtBuild, true);
  for (const key of ['physicalNetworkLossProven', 'physicalDeviceTested', 'iosUiExecuted', 'productionDeployed',
    'productionWrites', 'fullNativeGatePassed', 'releaseComplete']) assert.equal(summary[key], false, key);
  assert.equal(service.projectId, 'demo-sgm-local-qa'); assert.equal(service.completed, true);
  assert.equal(service.checks.length, 8); assert(service.checks.every(row => row.status === 'passed'));
  assert.equal(new Set(service.checks.map(row => row.id)).size, 8);
  assert.equal(service.scope, 'loopback-http-review-disconnects-and-real-isolated-callables-not-phone-or-production');
  assert.equal(service.protectedRecordCount, 158);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed']) assert.equal(service[key], true);
  for (const key of ['physicalNetworkLossProven', 'phoneUiExecuted', 'productionWrites']) assert.equal(service[key], false);
  assert.equal(service.providerRequests, 0); assert.equal(service.emulatorEndpoints.closed, true);
  assert.deepEqual(service.attempts.map(row => [row.mode, row.upstreamAcknowledged]),
    [['drop-before', false], ['pass', true], ['drop-after', true], ['pass', true]]);
  assert.equal(service.attempts[0].rideSessionId, service.attempts[1].rideSessionId);
  assert.equal(service.attempts[2].rideSessionId, service.attempts[3].rideSessionId);
  assert.notEqual(service.attempts[0].rideSessionId, service.attempts[2].rideSessionId);
  assert.equal(device.installedBytesVerified, true); assert.equal(device.serial, 'emulator-5580');
  assert.equal(Object.keys(device.installedApkHashes).length, 2);
  for (const hash of Object.values(device.installedApkHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(device.captures).sort(), recoveryCaptureIds.map(id => 'review-submission-network-' + id + '.png').sort());
  assert.equal(disposal.ownedEmulatorProcessAbsent, true); assert.equal(disposal.endpointsClosed, true);
  assert.equal(disposal.readOnlyAvdOverlayDiscarded, true);
  assert.deepEqual(disposal.ports, [5001, 8080, 9000, 9099, 5580, 5037]);
  assert.deepEqual(units, {tests: 641, failures: 0, errors: 0, skipped: 0});
  return summary;
}
export function validateReviewRecovery(root, reference = {source: reviewRecoveryFolder + 'summary.json'}) {
  assert.equal(reference.source, reviewRecoveryFolder + 'summary.json');
  const base = resolve(root, reviewRecoveryFolder), json = name => JSON.parse(readFileSync(resolve(base, name + '.json')));
  const text = name => readFileSync(resolve(base, name), 'utf8');
  assertEvidenceBundleChecksums(base);
  const service = json('service'), device = json('device-copy'), units = json('android-unit-counts');
  const result = assertReviewRecovery({summary: json('summary'), service, device, units, disposal: json('disposal')});
  assertRetainedSourceFiles(root, service.sourceFiles); assertRetainedSourceFiles(root, json('native-sources'));
  assert.match(text('before.txt'), /could not find any node.*29 octobre 2026 à 18:45/);
  assert.match(text('intermediate.txt'), /expected:<1> but was:<2>/);
  assertInstrumentationPassed(text('components.txt'), 11);
  assert.match(text('backend-units.txt'), /547 passed \(547\)/);
  assert.match(text('android-build.txt'), /BUILD SUCCESSFUL/);
  for (const [file, key, count] of [['context-regression', 'steps', 7], ['received-regression', 'checks', 8]]) {
    const regression = json(file); assert.equal(regression.completed, true);
    assert.equal(regression[key].length, count); assert(regression[key].every(row => row.status === 'passed'));
    assert.equal(regression.isolatedEnvironmentDestroyed, true); assert.equal(regression.productionWrites, false);
    assertRetainedSourceFiles(root, regression.sourceFiles);
  }
  const observed = {tests: 0, failures: 0, errors: 0, skipped: 0}, parser = new XMLParser({ignoreAttributes: false});
  for (const file of readdirSync(resolve(base, 'junit'))) {
    const suite = parser.parse(text('junit/' + file)).testsuite;
    for (const key of Object.keys(observed)) observed[key] += Number(suite['@_' + key] ?? 0);
  }
  assert.deepEqual(observed, units);
  const hashes = json('artifact-sha256');
  for (const [file, hash] of Object.entries(device.captures)) assert.equal(hashes['captures/' + file], hash);
  return result;
}
