import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { profileLedgerPhonePhases, verifyProfileLedgerPhoneState } from '../scripts/qa/profile-ledger-phone-checkpoints.mjs';
import { validateProfileLedgerPhoneEvidence } from '../scripts/qa/profile-ledger-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/profile-ledger-phone-2026-10-24/';
const json = file => JSON.parse(readFileSync(resolve(root, folder, file)));
test('the actual nine phone checkpoints preserve protected data and retain all originals', () => {
  validateProfileLedgerPhoneEvidence(root, {source: folder + 'summary.json', checksums: folder + 'artifact-sha256.json', checkedAt: '2026-10-24'});
});
const first = json('baseline.json');
for (const [name, mutate] of [
  ['other account city', row => {row.cities.driver.city = 'Liège';}],
  ['wrong parent revision', row => {row.cities.parent.revision++;}],
  ['parent ledger', row => {row.ledgers.parent.rewards.balanceCents++;}],
  ['driver ledger', row => {row.ledgers.driver.impact.rideCount++;}],
  ['foreign record', row => {row.records.documents.users[0].data.unexpected = true;}],
  ['privileged claim', row => {row.records.claims[0].claims.admin = true;}],
  ['stored city event', row => {row.records.documents.profileCities.find(item => item.id === first.fixture.parentUid).data.revision++;}],
]) test('rejects a corrupted independent phone state: ' + name, () => {
  const row = json('parent-city-saved.json').state; mutate(row);
  assert.throws(() => verifyProfileLedgerPhoneState('parent-city-saved', first.baseline, row, first.fixture));
});
test('read-only navigation cannot quietly rewrite an accepted city event', () => {
  const previous = json('parent-city-saved.json').state, row = structuredClone(previous);
  row.records.documents.profileCities.find(item => item.id === first.fixture.parentUid).data.updatedAt = 'changed';
  assert.throws(() => verifyProfileLedgerPhoneState('parent-rewards', first.baseline, row, first.fixture, previous));
  assert.equal(profileLedgerPhonePhases.length, 9);
});
test('the two phone tours publish only reviewed synthetic exports and preserve release boundaries', () => {
  const published = new Set();
  for (const id of ['profile-city', 'impact']) {
    const flow = content.flows.find(row => row.id === id);
    assert.equal(flow.latestEvidence, 'phone'); assert.equal(flow.status, 'partial');
    assert.match(flow.remaining, /iPhone.*Pas encore en ligne/);
    assert(flow.tour.every(step => step.image.startsWith('profile-ledger-phone-')));
    for (const image of flow.images.filter(row => row.file.startsWith('profile-ledger-phone-'))) published.add(basename(captures[image.file]));
    assert(!/BrowserStack|Firebase|Firestore|SDK|Kotlin/i.test([flow.title, flow.summary, flow.verified, flow.remaining].join(' ')));
  }
  assert.deepEqual([...published].sort(), Object.keys(json('visual-review.json').published).sort());
  assert(!Object.values(captures).includes(folder + 'captures/driver-payments.png'));
  const observer = readFileSync(resolve(root, 'scripts/qa/manual-profile-ledger-phone-session.mjs'), 'utf8');
  assert(observer.includes('await db.terminate(); firestoreClientTerminated = true'));
  assert(observer.includes('await deleteApp(app); adminClientClosed = true'));
  const workflow = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert.equal(workflow.split('"scripts/qa/*profile-ledger*.mjs"').length - 1, 2);
  assert(workflow.includes('node --test tests/profile-ledger-phone.test.mjs'));
});
