import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content} from '../partner-portal/content.mjs';
import {validateLocationClockContract} from '../scripts/qa/location-clock-contract-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = 'docs/release/evidence/location-clock-contract-2026-10-25';
const record = {source: directory + '/summary.json', checksums: directory + '/artifact-sha256.json', checkedAt: '2026-10-25'};
test('the completed server-clock preparation retains authenticated results, future rejection and closed services', () => {
  const report = validateLocationClockContract(root, record);
  assert.equal(report.clientIntegrationExecuted, false); assert.equal(report.physicalGpsAccepted, false);
});
test('server-clock groundwork cannot refresh the failed phone run or accept a tracking flow', () => {
  const flow = content.flows.find(row => row.id === 'tracking');
  assert.equal(flow.status, 'blocked'); assert.equal(flow.latestEvidence, 'phone');
  assert.equal(flow.checkedAt, '2026-10-25'); assert.equal(flow.ui, undefined); assert.equal(flow.phone, undefined);
  assert(flow.trackingPhoneAttempt.source.includes('tracking-phone-clock-2026-10-25'));
  assert(flow.images.every(row => row.file.startsWith('tracking-attempt-')));
});
const mutations = [
  ['summary.json', row => { row.clientIntegrationExecuted = true; }],
  ['summary.json', row => { row.physicalGpsAccepted = true; }],
  ['summary.json', row => { row.productionDeployed = true; }],
  ['cleanup.json', row => { row.endpoints.closed = false; }],
  ['services.json', row => { row.clockObservations[0].serverTimeMs = row.clockObservations[0].after + 1; }],
  ['services.json', row => { row.clockObservations[0].serverTimeMs = row.clockObservations[0].before - 1; }],
  ['services.json', row => { row.clockObservations.find(value => value.receipts?.some(receipt => receipt.status === 'invalid'))
    .receipts[0].status = 'retained'; }],
  ['services.json', row => { row.adminClientClosed = false; }],
];
for (const [file, mutate] of mutations) test('clock groundwork rejects unsupported evidence: ' + file + ' ' + mutate, t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-clock-evidence-'));
  t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(resolve(root, directory), resolve(temp, directory), {recursive: true});
  const json = file => JSON.parse(readFileSync(resolve(temp, directory, file)));
  const sources = {...json('services.json').sourceFiles, ...json('summary.json').unitSourceFiles};
  mkdirSync(resolve(temp, 'docs/release/evidence/source-archive'), {recursive: true});
  for (const hash of Object.values(sources)) copyFileSync(resolve(root, 'docs/release/evidence/source-archive', hash + '.txt'),
    resolve(temp, 'docs/release/evidence/source-archive', hash + '.txt'));
  const changed = json(file); mutate(changed);
  const bytes = JSON.stringify(changed); writeFileSync(resolve(temp, directory, file), bytes);
  const hashes = json('artifact-sha256.json'); hashes[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(temp, directory, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateLocationClockContract(temp, record));
});
test('the existing smoke workflow replays the clock contract as well as its immutable evidence', () => {
  const workflow = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert(workflow.includes('npm run test:location-order'));
  assert(workflow.includes('tests/location-clock-evidence.test.mjs'));
});
