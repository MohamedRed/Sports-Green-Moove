import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {content, captures} from '../partner-portal/content.mjs';
import {assertInvitationAliasReview, invitationAliasFolder, validateInvitationAliasPhone} from '../scripts/qa/invitation-alias-phone-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
test('the actual phone form and mismatch do not imply signup, parent approval or release acceptance', () => {
  assert.deepEqual(validateInvitationAliasPhone(root), {formReached: true, mismatchRefused: true,
    accountsCreated: 0, parentApprovalProven: false, releaseComplete: false});
});
for (const key of ['installedApkIndependentlyHashed', 'childAccountCreated', 'parentApprovalProven',
  'nativeShareToSignupProven', 'helperConnectionContinuityProven', 'rootCauseConfirmed', 'productionWrites',
  'realPayments', 'requestLoggingEnabled', 'resolveAllUrlsEnabled', 'videoRecorded', 'releaseComplete'])
  test('the partial alias trial rejects promotion of ' + key, () => {
    const review = JSON.parse(readFileSync(resolve(root, invitationAliasFolder, 'review.json')));
    review[key] = true; assert.throws(() => assertInvitationAliasReview(review), new RegExp(key));
  });
test('public progress keeps earlier phone evidence and adds only three reviewed partial-form captures', () => {
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.checkedAt, '2026-11-02');
  assert.equal(flow.invitationAliasPhone.checkedAt, '2026-11-02'); assert.equal(flow.images.length, 16);
  for (const id of ['form-ready', 'mismatch-refused', 'signup-unconfirmed']) {
    assert.equal(captures['invitation-alias-' + id], invitationAliasFolder + 'captures/' + id + '.png');
    assert(flow.images.some(row => row.file === 'invitation-alias-' + id && row.alt.includes('capture de session')));
  }
  assert.equal(content.blockers.find(row => row.id === 'child-invitation-browser').previousLatestSource, invitationAliasFolder + 'README.md');
  const update = content.updates.find(row => row.source === invitationAliasFolder + 'README.md'); assert(update);
  assert.doesNotMatch(update.title + update.text, /BrowserStack|Firebase|SDK|localhost|port|APK/);
});
