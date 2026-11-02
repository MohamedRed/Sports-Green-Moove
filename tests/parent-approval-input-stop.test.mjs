import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {content} from '../partner-portal/content.mjs';
import {parentApprovalInputStopProgress} from '../partner-portal/parent-approval-input-stop.mjs';
import {assertParentApprovalInputStop, parentApprovalInputStopFolder, validateParentApprovalInputStop} from '../scripts/qa/parent-approval-input-stop-evidence.mjs';
import {validateFocusedCopyFailure} from '../scripts/qa/focused-copy-failure-evidence.mjs';
import {focusedCopyFailureProgress} from '../partner-portal/focused-copy-failure.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('the interrupted preparation preserves no-signup records and verified credential invalidation', () => {
  assert.deepEqual(validateParentApprovalInputStop(root), {signupProven: false, parentApprovalProven: false,
    credentialInvalidated: true, releaseComplete: false});
});
test('the incident cannot hide exposure or promote a corrected retry, parent approval or root cause', () => {
  const original = JSON.parse(readFileSync(resolve(root, parentApprovalInputStopFolder, 'incident.json')));
  for (const mutate of [value => value.sensitiveToolOutputOccurred = false,
    value => value.temporaryCredentialInvalidatedByDatasetDisposal = false,
    value => value.externalAutocompleteTransmission = 'none', value => value.childAccountCreated = true,
    value => value.parentApprovalProven = true, value => value.correctedPhoneRetryExecuted = true,
    value => value.releaseComplete = true, value => value.exactRoutingCauseProven = true]) {
    const changed = structuredClone(original); mutate(changed); assert.throws(() => assertParentApprovalInputStop(changed));
  }
});
test('the public note leaves previous successful signup and every gallery item intact', () => {
  const flow = content.flows.find(row => row.id === 'child-emergency');
  assert.equal(flow.status, 'partial'); assert.equal(flow.images.length, 16); assert.equal(flow.checkedAt, '2026-11-02');
  assert.equal(flow.approvedPrivateTrials.source, 'docs/release/evidence/approved-private-trials-2026-11-02/review.json');
  assert.equal(flow.parentApprovalInputStop.source, parentApprovalInputStopFolder + 'incident.json');
  assert(content.updates.includes(parentApprovalInputStopProgress));
  assert.doesNotMatch(parentApprovalInputStopProgress.title + parentApprovalInputStopProgress.text, /BrowserStack|Firebase|SDK|APK|localhost|mot de passe/);
});
test('the next-trial protocol requires observed focus, bounded clearing, no global selection and honest exposure handling', () => {
  const protocol = readFileSync(resolve(root, 'docs/ci/private-phone-input.md'), 'utf8');
  for (const fragment of ['fresh phone observation', 'bounded individual Backspace', 'do not send the next credential key',
    'autocomplete\ntransmission as possible', 'sensitive\ntool output occurred', 'fresh approval']) assert(protocol.includes(fragment), fragment);
  assert.match(protocol, /Do not use `super\+a`, `Meta\+A`, `Command\+A`/);
  assert.match(protocol, /not a\nclaim that a corrected phone retry has already executed/);
});
test('the real remote copy failure remains separate from the local clock-substring assertion correction', () => {
  assert.deepEqual(validateFocusedCopyFailure(root), {mainNativeJobPassed: true, focusedJobPassed: false,
    fullNativeGateAccepted: false, remoteFailureRepaired: false});
  assert(content.updates.includes(focusedCopyFailureProgress));
  assert.equal(content.blockers.find(row => row.id === 'native-evidence-copy').latestFocusedFailure.source,
    'docs/release/evidence/focused-copy-5d34c0f-2026-11-02/review.json');
  assert.doesNotMatch(focusedCopyFailureProgress.title + focusedCopyFailureProgress.text, /BrowserStack|Firebase|SDK|ADB|localhost/);
});
