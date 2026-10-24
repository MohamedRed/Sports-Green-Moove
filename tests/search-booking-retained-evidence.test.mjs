import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateRetainedSearchBooking } from '../scripts/qa/search-booking-retained-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';
import { detail } from '../partner-portal/src/render.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = 'docs/release/evidence/parent-search-booking-native-2026-10-20/';
const source = base + 'search-booking-results.json';
test('original native search, one two-seat booking, provider responses, checkpoints and cleanup validate together', () => {
  const report = validateRetainedSearchBooking(root, source);
  assert.equal(report.runId, 'b44e417a2b9f4e7dca4958f6a226b77a');
  assert.equal(report.verification.actualProviderRequests, 6);
});

for (const [label, file, change] of [
  ['failed primary transfer', 'adb-pull-parent-search-booking.json', r => { r.completed = false; }],
  ['missing driver approval', 'search-booking-results.json', r => { r.driverApprovedInApp = false; }],
  ['wrong child', 'search-booking-checkpoints.json', r => { r[1].state.booking.childId = 'foreign'; }],
  ['missing intermediate capacity', 'search-booking-checkpoints.json', r => { r[1].state.trip.seatsAvailable = 4; }],
  ['extra billable request', 'search-booking-provider.json', r => { r.requests.push(r.requests[0]); }],
  ['admin left installed', 'disposable-device-restore.json', r => { r.restoration.installAdmin.componentRemoved = false; }],
  ['wrong CI source', 'native-run.json', r => { r.headSha = '0'.repeat(40); }],
]) test(label + ' cannot inherit a pass after hashes are rebound', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-search-retained-unit-'));
  try {
    const out = resolve(temp, base); cpSync(resolve(root, base), out, { recursive: true });
    cpSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temp, 'docs/release/evidence/source-archive'), { recursive: true });
    const path = resolve(out, file), value = JSON.parse(readFileSync(path)); change(value);
    writeFileSync(path, JSON.stringify(value));
    const hashPath = resolve(out, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(hashPath));
    hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex'); writeFileSync(hashPath, JSON.stringify(hashes));
    assert.throws(() => validateRetainedSearchBooking(temp, source));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('the current phone tours preserve older local dates and exclude their weak original frames', () => {
  for (const id of ['search', 'booking']) {
    const flow = content.flows.find(row => row.id === id);
    assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-24');
    assert.equal(flow.phone.checkedAt, '2026-10-18'); assert.equal(flow.searchBookingUi.source, source);
    assert.match(detail(flow), /Essai sur téléphone du 24 octobre 2026/);
    assert(!detail(flow).includes('Essai sur téléphone du 20 octobre 2026'));
    assert(flow.images.some(step => step.file.startsWith('search-booking-')));
    assert.match(flow.remaining, /coupures|réponses perdues/);
  }
  const current = Object.entries(captures).filter(([id]) => id.startsWith('search-booking-'));
  assert.equal(current.length, 4);
  assert(!current.some(([, path]) => /-match.png$|-parent-approved.png$/.test(path)));
  assert.equal(content.flows.find(row => row.id === 'tracking').status, 'untested');
});
