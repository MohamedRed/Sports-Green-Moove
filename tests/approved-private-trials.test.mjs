import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {approvedPrivateTrialFolder, assertApprovedPrivateTrialReview, validateApprovedPrivateTrials} from '../scripts/qa/approved-private-trials-evidence.mjs';
import {content, captures} from '../partner-portal/content.mjs';
import {approvedPrivateTrialProgress} from '../partner-portal/approved-private-trials.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('one actual private signup and sign-in do not promote parent approval or the failed diagnostic', () => {
  assert.deepEqual(validateApprovedPrivateTrials(root), {childAccountCreated: true, nativeChildSignInObserved: true,
    parentApprovalProven: false, networkDiagnosticPassed: false, networkPropertyRestored: false, releaseComplete: false});
});
test('broader claims, missing crops or multiple redemptions cannot become accepted evidence', () => {
  const original = JSON.parse(readFileSync(resolve(root, approvedPrivateTrialFolder, 'review.json')));
  for (const key of ['parentApprovalProven', 'nativeShareToSignupProven', 'publicSignupDeployed', 'rootCauseConfirmed',
    'networkDiagnosticPassed', 'networkPropertyRestored', 'productionWrites', 'releaseComplete']) {
    const changed = structuredClone(original); changed[key] = true; assert.throws(() => assertApprovedPrivateTrialReview(changed));
  }
  for (const mutate of [value => value.redemptionCount++, value => value.accountCreatedCount++,
    value => value.publicCapturesAdded--, value => value.publicCropsReviewed = false]) {
    const changed = structuredClone(original); mutate(changed); assert.throws(() => assertApprovedPrivateTrialReview(changed));
  }
});
test('the public follow-up keeps every flow partial boundary and adds only three reviewed captures', () => {
  assert.equal(content.flows.length, 34);
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.images.length, 16); assert.equal(flow.checkedAt, '2026-11-02');
  assert.equal(flow.images[0].file, 'child-contact-phone'); assert.match(flow.remaining, /accord du parent/);
  for (const id of ['mismatch', 'created', 'child-home']) {
    assert.equal(captures['child-signup-' + id], approvedPrivateTrialFolder + 'phone/captures/' + id + '.png');
    assert(flow.images.some(row => row.file === 'child-signup-' + id && row.alt.includes('capture de session')));
  }
  assert.equal(content.blockers.find(row => row.id === 'child-invitation-browser').latestSource, approvedPrivateTrialFolder + 'README.md');
  for (const row of approvedPrivateTrialProgress) {
    assert(content.updates.includes(row));
    assert.doesNotMatch(row.title + row.text, /BrowserStack|Firebase|SDK|APK|localhost|Terraform/);
  }
});
