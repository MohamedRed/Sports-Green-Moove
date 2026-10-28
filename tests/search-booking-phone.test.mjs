import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateSearchBookingPhone, searchPhoneCaptures } from '../scripts/qa/search-booking-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), folder = 'docs/release/evidence/search-booking-phone-2026-10-24/';
const json = file => JSON.parse(readFileSync(resolve(root, folder, file)));
test('the actual phone exchange binds four saved stages, six real map calls and independent isolation', () => {
  validateSearchBookingPhone(root, folder + 'summary.json');
});
for (const [name, file, mutate] of [
  ['missing driver request notice', 'requested.json', row => {row.state.notifications = [];}],
  ['wrong driver recipient', 'requested.json', row => {row.state.notifications[0].userId = 'foreign';}],
  ['wrong child', 'approved.json', row => {row.state.booking.childId = 'foreign';}],
  ['foreign record changed', 'final-state.json', row => {row.documents.users[0].data.unrelated = true;}],
  ['extra paid request', 'provider.json', row => {row.requests.push(row.requests[0]);}],
  ['failed provider result', 'provider.json', row => {row.requests[0].completed = false;}],
  ['failed runtime close', 'runtime-cleanup.json', row => {row.providerBrokerClosed = false;}],
  ['fake full restart', 'summary.json', row => {row.wholeProcessRestart = true;}],
  ['fake simultaneous phones', 'summary.json', row => {row.simultaneousPhones = true;}],
  ['production APK', 'apk.json', row => {row.packageId = 'be.sportgreenmoove.app';}],
  ['different regression suite', 'services-red.json', row => {row.sourceFiles['scripts/qa/search-booking-notice-services-suite.mjs'] = '0'.repeat(64);}],
]) test('rejects a coherently rehashed but unsupported phone claim: ' + name, t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-search-phone-proof-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  cpSync(resolve(root, folder), resolve(temporary, folder), {recursive: true});
  const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temporary, archive), {recursive: true});
  const hashes = new Set(['services-red.json', 'services-green.json', 'phone-records.json'].flatMap(name => Object.values(json(name).sourceFiles)));
  for (const hash of hashes) cpSync(resolve(root, archive, hash + '.txt'), resolve(temporary, archive, hash + '.txt'));
  const row = json(file); mutate(row); const bytes = JSON.stringify(row), checksums = json('artifact-sha256.json');
  checksums[file] = createHash('sha256').update(bytes).digest('hex');
  writeFileSync(resolve(temporary, folder, file), bytes);
  writeFileSync(resolve(temporary, folder, 'artifact-sha256.json'), JSON.stringify(checksums));
  assert.throws(() => validateSearchBookingPhone(temporary, folder + 'summary.json'));
});
test('phone tours use all seven reviewed originals without replacing older evidence or accepting release scope', () => {
  const published = new Set();
  for (const id of ['search', 'booking']) {
    const flow = content.flows.find(row => row.id === id);
    assert.equal(flow.latestEvidence, 'phone'); assert.equal(flow.status, 'partial');
    assert.equal(flow.checkedAt, id === 'booking' ? '2026-10-28' : '2026-10-24');
    assert(flow.tour.every(step => step.image.startsWith(id === 'booking' ? 'booking-direct-' : 'search-phone-')));
    assert.equal(flow.searchBookingPhone.checkedAt, '2026-10-24');
    for (const image of flow.images.filter(row => row.file.startsWith('search-phone-'))) published.add(basename(captures[image.file]));
    assert(!/BrowserStack|Firebase|Firestore|SDK|Kotlin/i.test([flow.title, flow.summary, flow.verified, flow.remaining].join(' ')));
    assert.equal(flow.searchBookingUi.checkedAt, '2026-10-20'); assert.equal(flow.phone.checkedAt, '2026-10-18');
  }
  assert.deepEqual([...published].sort(), searchPhoneCaptures.map(name => name + '.png').sort());
  const workflow = readFileSync(resolve(root, '.github/workflows/web-integration-smoke.yml'), 'utf8');
  assert(workflow.includes('node scripts/qa/run-search-booking-notice-services.mjs'));
  assert(workflow.includes('node --test tests/search-booking-phone.test.mjs'));
  assert.equal(workflow.split('"scripts/qa/*search-booking*.mjs"').length - 1, 2);
  const launcher = readFileSync(resolve(root, 'scripts/qa/start-search-booking-phone.mjs'), 'utf8');
  assert(launcher.includes('--approved-2026-10-24-one-phone-trial-max-eight'));
  assert(!launcher.includes('runtime.env.SGM_REAL_MAPS_SERVER_KEY'));
  assert(launcher.indexOf("save('provider.json'") < launcher.indexOf('await broker.close()'));
});
