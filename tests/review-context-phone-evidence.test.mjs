import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {content, captures} from '../partner-portal/content.mjs';
import {assertContextPhoneAttempt, contextPhoneEvidenceFolder, validateContextPhoneAttempt} from '../scripts/qa/review-context-phone-evidence.mjs';

const root = resolve(import.meta.dirname, '..'), base = resolve(root, contextPhoneEvidenceFolder);
const json = file => JSON.parse(readFileSync(resolve(base, file + '.json')));
test('two actual phone checkpoints remain partial and preserve all earlier galleries and the tour', () => {
  const proof = validateContextPhoneAttempt(root, content.reviewContextPhoneAttempt);
  assert.equal(proof.twoAccountReplayCompleted, false);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'phone'); assert.equal(flow.images.length, 35);
  assert.equal(flow.tour.length, 4); assert(flow.tour.every(row => row.image.startsWith('review-page-')));
  assert.match(flow.remaining, /reconnexion/); assert.match(flow.remaining, /coupure/);
  for (const name of ['driver-context', 'driver-rated']) {
    const key = 'review-trip-phone-' + name;
    assert.equal(captures[key], contextPhoneEvidenceFolder + 'captures/' + name + '.jpg');
    assert.match(flow.images.find(row => row.file === key).alt, /capture de session du 29 octobre/);
  }
});
for (const key of ['twoAccountReplayCompleted', 'parentContextUiVerified', 'legacyContextUiVerified', 'reconnectionVerified',
  'processRestartProven', 'realNetworkLossVerified', 'installedBytesIndependentlyVerified', 'fullCurrentNativeGatePassed',
  'releaseComplete', 'credentialRotationPerformed']) test('rejects promotion of ' + key, () => {
  const summary = json('summary'); summary[key] = true; assert.throws(() => assertContextPhoneAttempt(summary, json('phone/session-results')));
});
for (const [name, mutate] of [
  ['invented parent checkpoint', phone => {phone.checks.push({...phone.checks[1], phase: 'parent-more'});}],
  ['changed parent requests', phone => {phone.checks[1].parentRequests = 31;}],
  ['fixture-provided final rating', phone => {phone.subsequentRatingsFixtureSubmitted = true;}],
  ['completed observer', phone => {phone.completed = true;}],
]) test('rejects ' + name, () => {
  const phone = json('phone/session-results'); mutate(phone); assert.throws(() => assertContextPhoneAttempt(json('summary'), phone));
});
test('altering a session capture invalidates the retained evidence', t => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-context-phone-proof-')); t.after(() => rmSync(temp, {recursive: true, force: true}));
  cpSync(base, resolve(temp, contextPhoneEvidenceFolder), {recursive: true});
  writeFileSync(resolve(temp, contextPhoneEvidenceFolder, 'captures/driver-context.jpg'), 'changed');
  assert.throws(() => validateContextPhoneAttempt(temp), /captures\/driver-context.jpg/);
});
