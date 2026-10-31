import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {searchDeparturePhoneFolder, validateSearchDeparturePhone} from '../scripts/qa/search-departure-phone-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const expected = {checkpoints: 12, captures: 5, physicalDateChoiceAccepted: true,
  physicalSearchRecoveryAccepted: false, releaseAccepted: false};
test('physical calendar trial retains all independent checkpoints without promoting the full search', () => {
  assert.deepEqual(validateSearchDeparturePhone(root), expected);
  const flow = content.flows.find(row => row.id === 'search');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-24');
  assert.equal(flow.searchDeparturePhone.source, searchDeparturePhoneFolder + 'review.json');
  assert.equal(flow.searchBookingPhone.checkedAt, '2026-10-24');
  assert.equal(flow.images.filter(row => row.file.startsWith('search-departure-')).length, 5);
  assert(flow.images.some(row => row.file === 'search-phone-requested'));
  const review = JSON.parse(readFileSync(resolve(root, flow.searchDeparturePhone.source)));
  for (const [name, path] of Object.entries(review.publishedCaptures)) assert.equal(captures[name], searchDeparturePhoneFolder + path);
  assert.equal(content.blockers.some(row => row.id === 'search-departure-phone'), false);
  assert.equal(content.updates.find(row => row.flow === 'search').source, searchDeparturePhoneFolder + 'README.md');
});
function shadow() {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-search-calendar-phone-'));
  const folder = resolve(temp, searchDeparturePhoneFolder);
  cpSync(resolve(root, searchDeparturePhoneFolder), folder, {recursive: true});
  const manifests = [JSON.parse(readFileSync(resolve(folder, 'records/results.json'))).sourceFiles,
    JSON.parse(readFileSync(resolve(folder, 'app-source-sha256.json')))];
  const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temp, archive), {recursive: true});
  for (const digest of new Set(manifests.flatMap(row => Object.values(row))))
    cpSync(resolve(root, archive, digest + '.txt'), resolve(temp, archive, digest + '.txt'));
  return {temp, folder};
}
function mutate(file, change, expectedError) {
  const {temp, folder} = shadow();
  try {
    assert.deepEqual(validateSearchDeparturePhone(temp), expected);
    const value = JSON.parse(readFileSync(resolve(folder, file))); change(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(folder, file), bytes);
    const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateSearchDeparturePhone(temp), expectedError);
  } finally {rmSync(temp, {recursive: true, force: true});}
}
for (const key of ['physicalSearchRecoveryAccepted', 'physicalBookingRecoveryAccepted', 'fullProcessRestartAccepted',
  'realMapsExercised', 'realPaymentsExercised', 'productionWrites', 'iOSUiAccepted', 'screenReaderAccepted',
  'releaseAccepted', 'packageRemovalIndependentlyVerified', 'installedBytesIndependentlyAttested',
  'previousAuthenticationFailureCauseEstablished', 'helperExitCauseEstablished'])
  test('rehashing cannot promote calendar proof to ' + key, () => mutate('review.json', row => {row[key] = true;}, new RegExp(key)));
test('a changed foreign account claim fails despite a recomputed checksum', () =>
  mutate('records/dark.json', row => {row.state.claims[0].claims.injected = true;}, /cannot change flow records/));
test('a changed live trip fails despite a recomputed checksum', () =>
  mutate('records/search-reopened.json', row => {row.state.liveTrips = {injected: true};}, /cannot change flow records/));
test('provider no-apps message cannot become an uninstall acknowledgment', () =>
  mutate('phone-disposal.json', row => {row.uninstallAcknowledged = true;}));
