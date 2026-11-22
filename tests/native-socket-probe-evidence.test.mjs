import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {validateNativeSocketProbe, validateNativeSocketProbeScope} from '../scripts/qa/native-socket-probe-evidence.mjs';
import {content} from '../partner-portal/content.mjs';
const directory = 'docs/release/evidence/native-socket-probe-2026-10-25';
const record = {source: directory + '/summary.json', checksums: directory + '/artifact-sha256.json', checkedAt: '2026-10-25'};
test('independent HTTP and native socket observations preserve their exact scope and cleanup', () => {
  const report = validateNativeSocketProbe(process.cwd(), record);
  assert.equal(report.isolatedTransportMismatchObserved, true); assert.equal(report.productionBugProven, false);
  const flow = content.flows.find(row => row.id === 'tracking-network');
  assert.equal(flow.status, 'partial'); assert.deepEqual(flow.trackingNetworkTransportProbe, record);
  assert.equal(flow.images.length, 3); assert(flow.images.every(row => row.file.startsWith('tracking-network-')));
  assert.equal(content.blockers.find(row => row.id === 'tracking-reconnect-display').source, directory + '/README.md');
});
for (const key of ['productionBugProven', 'providerWideLimitationProven', 'mainAppCodeChanged', 'workaroundInstalled',
  'trackingFlowAccepted', 'productionWrites', 'releaseScenariosAccepted']) test('the probe cannot claim: ' + key, () => {
    const report = JSON.parse(readFileSync(record.source));
    assert.throws(() => validateNativeSocketProbeScope({...report, [key]: true}));
  });
for (const [key, value] of [['httpResult', 'FAILED'], ['nativeSocketResult', 'CONNECTED_ORIGIN_UNVERIFIED'],
  ['ownedServerRequestCount', 0], ['configuredHost', '0.0.0.0'], ['accountsUsed', 1]])
  test('a different observation cannot satisfy the diagnostic proof: ' + key, () => {
    const report = JSON.parse(readFileSync(record.source));
    assert.throws(() => validateNativeSocketProbeScope({...report, [key]: value}));
  });
test('the device protocol requires a live event connection before a tracking replay', () => {
  const protocol = readFileSync('docs/release/real-device-test-protocol.md', 'utf8');
  assert(protocol.includes('HTTP success alone is insufficient')); assert(protocol.includes('stop the tracking replay'));
  assert(protocol.includes('does not replace any production-provider release scenario'));
});
