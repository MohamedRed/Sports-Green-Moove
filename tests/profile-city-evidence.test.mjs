import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { validateProfileCityEvidence, validateProfileCityReports } from '../scripts/qa/profile-city-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/profile-city-2026-10-24/';
const json = file => JSON.parse(readFileSync(resolve(root, folder, file)));
test('retained city proof binds the native exchange, service isolation and disposal without release acceptance', () => {
  validateProfileCityEvidence(root, { source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24' });
});
test('partial, simulated-only and physically overstated city reports are rejected', () => {
  const service = json('services.json'), native = json('native.json');
  for (const mutate of [pair => { pair[0].checks.pop(); }, pair => { pair[1].connectedCases = 0; },
    pair => { pair[1].physicalDevice = true; }, pair => { pair[1].fullProcessRestart = true; },
    pair => { pair[1].protectedRecordsUnchanged = false; }, pair => { pair[1].localPackagesRemoved = false; },
    pair => { pair[0].firestoreClientTerminated = false; }]) {
    const pair = structuredClone([service, native]); mutate(pair);
    assert.throws(() => validateProfileCityReports(...pair));
  }
});
test('public city copy preserves its dated local gallery under the newer phone trial', () => {
  const flow = content.flows.find(row => row.id === 'profile-city'), review = json('visual-review.json');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone');
  assert.deepEqual(flow.images.filter(image => image.file.startsWith('profile-city-')).map(image => basename(captures[image.file])).sort(), Object.keys(review.published).sort());
  assert(flow.remaining.includes('Pas encore en ligne'));
  assert(!/BrowserStack|Firebase|Firestore|SDK|Android|Kotlin/i.test([flow.title, flow.summary, flow.verified, flow.remaining].join(' ')));
});
