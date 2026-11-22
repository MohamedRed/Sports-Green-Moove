import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export function validateLocationClockContract(root, record) {
  const base = resolve(root, dirname(record.source));
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assertEvidenceBundleChecksums(base);
  const json = file => JSON.parse(readFileSync(resolve(base, file)));
  const summary = json('summary.json'), services = json('services.json'), cleanup = json('cleanup.json');
  assert.equal(summary.checkedAt, record.checkedAt);
  assert.equal(summary.scope, 'server-clock-contract-only-not-native-tracking');
  for (const key of ['clientIntegrationExecuted', 'physicalGpsAccepted', 'productionDeployed', 'releaseComplete'])
    assert.equal(summary[key], false);
  assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.testedAt.slice(0, 10), summary.checkedAt);
  assert.equal(services.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(services.adminClientClosed, true); assert.equal(services.providerRequests, 0);
  for (const key of ['nativeUiExecuted', 'physicalDevice', 'productionWrites', 'providerWebhookDelivery', 'auditAcceptance'])
    assert.equal(services[key], false);
  assert.equal(services.checks.length, 11); assert.equal(new Set(services.checks.map(row => row.id)).size, 11);
  assert(services.checks.every(row => row.status === 'passed'));
  assert(services.checks.some(row => row.id === 'authenticated-server-clock-reference-does-not-relax-native-capture-validation'));
  assert.equal(services.concurrentRequestCount, 12); assertRetainedSourceFiles(root, services.sourceFiles);
  assertRetainedSourceFiles(root, summary.unitSourceFiles);
  assert.equal(cleanup.runId, services.runId); assert.equal(cleanup.endpoints.closed, true);
  assert.equal(cleanup.endpoints.host, '127.0.0.1');
  assert.deepEqual(cleanup.endpoints.ports, [5001, 8080, 9000, 9099]);
  const observations = services.clockObservations;
  assert.equal(observations.length, 19);
  let reads = 0, invalid = 0, writes = 0, retained = 0;
  const rideIds = new Set();
  for (const row of observations) {
    for (const key of ['before', 'serverTimeMs', 'after']) assert(Number.isSafeInteger(row[key]) && row[key] > 0);
    assert(row.before <= row.serverTimeMs && row.serverTimeMs <= row.after);
    if (row.endpoint === 'getActiveRide') { reads++; rideIds.add(row.rideSessionId); continue; }
    assert.equal(row.endpoint, 'writeLocationBatch'); assert(Array.isArray(row.receipts));
    assert.equal(row.written, row.receipts.filter(receipt => receipt.status === 'written').length);
    assert.equal(row.ignored, row.receipts.length - row.written);
    for (const receipt of row.receipts) {
      assert.equal(receipt.role, 'driver'); assert(Number.isSafeInteger(receipt.capturedAt));
      rideIds.add(receipt.rideSessionId);
      if (receipt.status === 'invalid') { invalid++; assert(receipt.capturedAt > row.serverTimeMs); }
      else {
        assert(['written', 'retained'].includes(receipt.status)); assert(receipt.capturedAt <= row.serverTimeMs);
        if (receipt.status === 'written') writes++; else retained++;
      }
    }
  }
  assert.equal(reads, 1); assert.equal(rideIds.size, 1); assert.equal(invalid, 1);
  assert(writes >= 2); assert(retained >= 6);
  const junit = new XMLParser({ignoreAttributes: false}).parse(readFileSync(resolve(base, 'backend-unit.xml'), 'utf8')).testsuites;
  assert.equal(Number(junit['@_tests']), 480); assert.equal(Number(junit['@_failures']), 0); assert.equal(Number(junit['@_errors']), 0);
  const suite = junit.testsuite.find(row => row['@_name'] === 'src/__tests__/location-clock-callables.test.ts');
  assert.equal(Number(suite['@_tests']), 12); assert.equal(Number(suite['@_failures']), 0);
  assert.equal(Number(suite['@_skipped'] ?? 0), 0);
  const log = readFileSync(resolve(base, 'services.log.txt'), 'utf8');
  assert(log.includes('Script exited successfully (code 0)'));
  for (const emulator of ['Functions', 'Database', 'Firestore', 'Authentication'])
    assert(log.includes('Stopping ' + emulator + ' Emulator'));
  return summary;
}
