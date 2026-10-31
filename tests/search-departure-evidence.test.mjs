import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseDocument} from 'yaml';
import {content} from '../partner-portal/content.mjs';
import {searchDepartureFolder, validateSearchDepartureEvidence} from '../scripts/qa/search-departure-evidence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const expected = {unitCasesPassed: 10, selectedNativeCasesPassed: 11, physicalDateChoiceAccepted: false, releaseAccepted: false};
test('real native cases and failed physical authentication retain separate source-bound results', () => {
  assert.deepEqual(validateSearchDepartureEvidence(root), expected);
  const flow = content.flows.find(row => row.id === 'search');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-10-24'); assert.equal(flow.latestEvidence, 'phone');
  assert.equal(flow.searchDepartureReview.source, searchDepartureFolder + 'review.json');
  assert(content.updates.some(row => row.source === searchDepartureFolder + 'README.md'));
  assert(content.updates.some(row => row.flow === 'messages' && row.source === searchDepartureFolder + 'README.md'));
  assert.equal(content.blockers.some(row => row.id === 'search-departure-phone'), false);
});
function shadowEvidence() {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-search-date-evidence-'));
  const folder = resolve(temp, searchDepartureFolder); cpSync(resolve(root, searchDepartureFolder), folder, {recursive: true});
  const json = file => JSON.parse(readFileSync(resolve(folder, file)));
  const manifests = ['before/source-sha256.json', 'candidate/source-sha256.json', 'final/source-sha256.json'].map(json);
  manifests.push(json('phone/results.json').sourceFiles, json('phone/failure-state.json').sourceFiles);
  manifests.push(...json('preparation/superseded-ci.json').map(row => row.sourceFiles));
  manifests.push(json('native/replay-source-sha256.json'));
  const archive = 'docs/release/evidence/source-archive'; mkdirSync(resolve(temp, archive), {recursive: true});
  for (const digest of new Set(manifests.flatMap(manifest => Object.values(manifest)))) {
    assert.match(digest, /^[a-f0-9]{64}$/);
    cpSync(resolve(root, archive, digest + '.txt'), resolve(temp, archive, digest + '.txt'));
  }
  const older = json('before/review.json').previousSearchCapture;
  assert(older.startsWith('docs/release/evidence/accent-controls-phone-2026-10-30/captures/'));
  mkdirSync(dirname(resolve(temp, older)), {recursive: true}); cpSync(resolve(root, older), resolve(temp, older));
  return {temp, folder};
}
for (const key of ['physicalDateChoiceAccepted', 'physicalSearchRecoveryAccepted', 'physicalBookingRecoveryAccepted',
  'authenticationFailureCauseEstablished', 'authenticationTimeoutEstablished', 'previousCaptureFailureRepaired', 'iOSUiAccepted', 'realMapsExercised',
  'realPaymentsExercised', 'productionWrites', 'screenReaderAccepted', 'releaseAccepted', 'fullNativeGateAccepted',
  'offlineChatSequenceAccepted', 'networkPreparationCauseEstablished'])
  test(`rehashing cannot promote this result to ${key}`, () => {
    const {temp, folder} = shadowEvidence();
    try {
      assert.deepEqual(validateSearchDepartureEvidence(temp), expected, 'The untouched shadow must validate before mutation');
      const review = JSON.parse(readFileSync(resolve(folder, 'review.json'))); review[key] = true;
      const bytes = JSON.stringify(review); writeFileSync(resolve(folder, 'review.json'), bytes);
      const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
      hashes['review.json'] = createHash('sha256').update(bytes).digest('hex');
      writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
      assert.throws(() => validateSearchDepartureEvidence(temp), new RegExp(key));
    } finally {rmSync(temp, {recursive: true, force: true});}
  });
test('both CI workflows execute the new contracts and real evidence checks without skipping old workloads', () => {
  for (const name of ['native-ci', 'web-integration-smoke']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows/' + name + '.yml'), 'utf8')).toJSON();
    const matches = Object.values(workflow.jobs).flatMap(job => job.steps ?? [])
      .filter(step => step.name === 'Validate native search departure controls and blocked phone evidence');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].run, 'node --test tests/search-departure-contract.test.mjs tests/search-departure-evidence.test.mjs');
    assert.equal(matches[0]['continue-on-error'], undefined); assert.equal(matches[0].if, undefined);
    for (const event of ['pull_request', 'push']) assert(workflow.on[event].paths.includes('tests/search-departure*.test.mjs'));
  }
});
