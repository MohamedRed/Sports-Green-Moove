import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {parseAndroidJUnitTranscript} from '../scripts/qa/android-junit-transcript.mjs';
import {content} from '../partner-portal/content.mjs';
import {androidCutoffProgress} from '../partner-portal/android-cutoff-recheck.mjs';

const folder = new URL('../docs/release/evidence/native-cutoff-2026-11-04/', import.meta.url);
const bytes = name => readFileSync(new URL(name, folder));
const json = name => JSON.parse(bytes(name));

test('the interrupted ordinary command remains a host timeout and incomplete discovered inventory', () => {
  assertEvidenceBundleChecksums(resolve(folder.pathname));
  const selection = json('selection.json');
  assert.equal(selection.sourceCommit, '9fd5bf3e599017e114cf530afb72e47c47e68cdd');
  assert.equal(selection.selectedMembersComparedByteForByte, true);
  for (const [name, row] of Object.entries(selection.members)) {
    const value = row.encoding === 'gzip' ? gunzipSync(bytes(name)) : bytes(name);
    assert.equal(createHash('sha256').update(value).digest('hex'), row.originalMemberSha256);
  }
  assert.deepEqual(json('ordinary-process.json'), {scope: 'single-ordinary-instrumentation-command-not-flow-proof',
    status: null, signal: 'SIGTERM', errorCode: 'ETIMEDOUT', elapsedMs: 720007, stderr: ''});
  const transcript = gunzipSync(bytes('ordinary-instrumentation.txt.gz')).toString();
  assert.match(transcript, /INSTRUMENTATION_STATUS: current=336/);
  assert.match(transcript, /INSTRUMENTATION_STATUS: numtests=349/);
  assert.doesNotMatch(transcript, /^INSTRUMENTATION_CODE:/m);
  assert.throws(() => parseAndroidJUnitTranscript(transcript));
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1});
  assert.equal(json('device-restoration.json').verified, true);
});

test('the completed web rollup and ten focused passes cannot erase the two Android failures', () => {
  const checks = json('checks.json');
  assert.equal(checks.headRefOid, json('selection.json').sourceCommit);
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.deepEqual(['SUCCESS', 'SKIPPED', 'FAILURE'].map(c => checks.statusCheckRollup.filter(r => r.conclusion === c).length), [21, 6, 3]);
  const focused = checks.statusCheckRollup.filter(r => r.name.startsWith('Android focused safety UI tests / Isolated ') &&
    r.name !== 'Android focused safety UI tests / Isolated safety flows');
  assert.equal(focused.length, 11); assert.equal(focused.filter(r => r.conclusion === 'SUCCESS').length, 10);
  const network = json('focused-network.json');
  assert.equal(network.completed, false); assert.equal(network.failedPhase, 'network-preparation');
  assert.deepEqual(network.network, []); assert.equal(network.preparationFailure.hasDefaultDataSubscription, false);
  assert.equal(network.preparationFailure.cellularAvailableCallbacks, 0);
  assert.equal(network.cellularRequestReleased, true); assert.equal(network.wifiRequestReleased, true);
  assert.match(gunzipSync(bytes('guardian-instrumentation.txt.gz')).toString(), /LocalGuardianVerificationFlowTest.kt:94/);
});

test('the dated progress note retains earlier history without stack names or accepted phone claims', () => {
  const previous = JSON.parse(readFileSync(new URL('../docs/release/evidence/compatible-security-patches-2026-11-03/portal-after-content.json', import.meta.url)));
  assert(content.updates.some(row => row.source === androidCutoffProgress.source));
  const expected = [androidCutoffProgress, ...previous.updates], hash = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const historical = new Set(expected.map(hash));
  assert.deepEqual(content.updates.filter(row => historical.has(hash(row))), expected);
  assert.doesNotMatch(androidCutoffProgress.title + androidCutoffProgress.text, /Firebase|BrowserStack|Android|Pixel|JUnit|SIGTERM|ETIMEDOUT|SDK|CI/);
  assert.match(androidCutoffProgress.text, /simulation/); assert.match(androidCutoffProgress.text, /avant la fin/);
});
