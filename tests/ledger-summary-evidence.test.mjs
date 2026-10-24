import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { content, captures } from '../partner-portal/content.mjs';
import { validateLedgerSummaryEvidence } from '../scripts/qa/ledger-summary-evidence.mjs';

const root = process.cwd(), folder = 'docs/release/evidence/ledger-history-2026-10-24';
const record = {source: folder + '/summary.json', checksums: folder + '/artifact-sha256.json', checkedAt: '2026-10-24'};
const json = file => JSON.parse(readFileSync(resolve(root, folder, file)));
test('the complete SDK-backed history case retains actual queries, primary captures and verified disposal', () => {
  validateLedgerSummaryEvidence(root, record);
});
for (const [file, key, value] of [['native.json', 'physicalDevice', true], ['native.json', 'fullProcessRestart', true],
  ['native.json', 'protectedRecordsUnchanged', false], ['native.json', 'balanceCents', 10_000],
  ['native.json', 'adminClientClosed', false], ['summary.json', 'productionDeployed', true],
  ['device-cleanup.json', 'hostExited', false], ['environment-cleanup.json', 'runtimeDirectoryAbsent', false]])
  test('rejects a rehashed unsupported ledger claim: ' + file + '/' + key, t => {
    const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-ledger-proof-'));
    t.after(() => rmSync(temporary, {recursive: true, force: true}));
    cpSync(resolve(root, folder), resolve(temporary, folder), {recursive: true});
    const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temporary, archive), {recursive: true});
    const hashes = new Set(Object.values({...json('services.json').sourceFiles, ...json('native.json').sourceFiles, ...json('legacy-native-source.json')}));
    for (const hash of hashes) cpSync(resolve(root, archive, hash + '.txt'), resolve(temporary, archive, hash + '.txt'));
    const row = json(file); row[key] = value;
    const bytes = JSON.stringify(row), checksum = json('artifact-sha256.json');
    writeFileSync(resolve(temporary, folder, file), bytes);
    checksum[file] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(temporary, folder, 'artifact-sha256.json'), JSON.stringify(checksum));
    assert.throws(() => validateLedgerSummaryEvidence(temporary, record));
  });
test('the public tour uses only reviewed originals and preserves the older dated ride evidence', () => {
  const flow = content.flows.find(row => row.id === 'impact'), review = json('visual-review.json');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'local');
  assert.equal(flow.ui.checkedAt, '2026-10-15'); assert.equal(flow.local.checkedAt, '2026-10-15');
  assert.deepEqual(flow.images.filter(row => row.file.startsWith('ledger-history-')).map(row => basename(captures[row.file])).sort(),
    Object.keys(review.published).sort());
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(step => step.image.startsWith('ledger-history-')));
  assert.match(flow.remaining, /téléphone.*iPhone.*Pas encore en ligne/);
  assert(!/BrowserStack|Firebase|Firestore|SDK|Android|Kotlin/i.test([flow.title, flow.summary, flow.verified, flow.remaining].join(' ')));
});
