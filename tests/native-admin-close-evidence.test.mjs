import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { content } from '../partner-portal/content.mjs';
import { validateNativeAdminClose } from '../scripts/qa/native-admin-close-evidence.mjs';

const record = content.nativeClientClosureRecheck;
test('the completed replay closes clients and resources without accepting physical release scope', () => {
  const report = validateNativeAdminClose(process.cwd(), record);
  assert.equal(report.nativeGroupsPassed, 37); assert.equal(report.nativeCasesPassed, 40);
  assert.equal(report.releaseComplete, false); assert.equal(report.allScenarioArtifactsIndependentlyRevalidated, false);
  assert.equal(content.blockers.find(row => row.id === 'notification-native-replay'), undefined);
  assert(content.updates.some(row => row.source === content.adminClientLifecycleRecheck.source.replace('results.json', 'README.md')));
});
for (const [file, key, value] of [['summary.json', 'physicalTrackingAccepted', true], ['summary.json', 'releaseComplete', true],
  ['summary.json', 'allScenarioArtifactsIndependentlyRevalidated', true], ['native/results.json', 'adminClientClosed', false],
  ['native/results.json', 'firestoreClientTerminated', false], ['native-run.json', 'conclusion', 'cancelled'],
  ['host-observation.json', 'finalState', 'zombie'], ['device-restoration.json', 'verified', false]]) {
  test('completed replay evidence rejects changed ' + file + ':' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-native-close-proof-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const base = dirname(record.source); cpSync(base, resolve(root, base), { recursive: true });
    const path = resolve(root, base, file), report = JSON.parse(readFileSync(path)); report[key] = value;
    writeFileSync(path, JSON.stringify(report)); assert.throws(() => validateNativeAdminClose(root, record));
  });
}
