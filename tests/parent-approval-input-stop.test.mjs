import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {content} from '../partner-portal/content.mjs';
import {parentApprovalInputStopProgress} from '../partner-portal/parent-approval-input-stop.mjs';
import {assertParentApprovalInputStop, parentApprovalInputStopFolder, validateParentApprovalInputStop} from '../scripts/qa/parent-approval-input-stop-evidence.mjs';
import {validateFocusedCopyFailure, validateCurrentNativeFailure, assertCurrentNativeFailureScope,
  currentNativeFailureFolder} from '../scripts/qa/focused-copy-failure-evidence.mjs';
import {focusedCopyFailureProgress} from '../partner-portal/focused-copy-failure.mjs';
import {assertC84ChecksScope, c84ChecksFolder, validateC84Checks} from '../scripts/qa/c84-checks-evidence.mjs';
import {c84ChecksProgress} from '../partner-portal/c84-checks.mjs';

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
test('the terminal current-source failure keeps ordinary passes separate from the incomplete whole gate', () => {
  assert.deepEqual(validateCurrentNativeFailure(root), {ordinaryPassed: 248, focusedPassed: 9,
    fullNativeGateAccepted: false, rootCauseConfirmed: false});
  const blocker = content.blockers.find(row => row.id === 'native-evidence-copy');
  assert.equal(blocker.latestCheck.source, currentNativeFailureFolder + 'review.json');
  assert.doesNotMatch(blocker.text, /Le contrôle principal passe/);
  assert.equal(focusedCopyFailureProgress.source, currentNativeFailureFolder + 'README.md');
  assert.equal(content.updates.filter(row => row === focusedCopyFailureProgress).length, 1);
});
test('the latest report cannot promote cleanup copies, archive verification or parent and physical acceptance', () => {
  const original = JSON.parse(readFileSync(resolve(root, currentNativeFailureFolder, 'review.json')));
  for (const key of ['originalArchiveDigestIndependentlyVerified', 'fullNativeGateAccepted', 'primaryCopyRepaired',
    'signupParentApprovalAccepted', 'physicalDeviceAccepted', 'releaseComplete', 'rootCauseConfirmed']) {
    const changed = structuredClone(original); changed[key] = true;
    assert.throws(() => assertCurrentNativeFailureScope(changed), key);
  }
});
test('the later source passes the main matrix but preserves the separate network failure and cancelled web gate', () => {
  assert.deepEqual(validateC84Checks(root), {nativeMainPassed: true, wholeNativeGatePassed: false,
    wholeWebGatePassed: false, releaseAccepted: false});
  assert(content.updates.includes(c84ChecksProgress));
  assert.doesNotMatch(c84ChecksProgress.title + c84ChecksProgress.text, /BrowserStack|Firebase|SDK|APK|CI|Linux/);
  assert.equal(content.blockers.find(row => row.id === 'native-evidence-copy').latestResult.source, c84ChecksFolder + 'review.json');
  assert.equal(createHash('sha256').update(JSON.stringify(content.flows)).digest('hex'),
    'b5772455f74ec402c5b25acfa5736917c7e8db4a3332725a416868d18cacadd8');
});
test('a main-job pass cannot accept the whole gate, a root cause, parent approval or physical tracking', () => {
  const original = JSON.parse(readFileSync(resolve(root, c84ChecksFolder, 'review.json')));
  for (const key of ['wholeNativeGatePassed', 'wholeWebGatePassed', 'chatNetworkFlowPassed', 'webFinalizationCauseProven',
    'captureIntermittencyRepaired', 'parentApprovalProven', 'physicalTrackingAccepted', 'releaseAccepted', 'productionWrites'])
    assert.throws(() => assertC84ChecksScope({...original, [key]: true}), new RegExp(key));
});
for (const [file, mutate] of [
  ['web-jobs.json', row => {row.jobs.find(job => job.id === 125573409996).conclusion = 'success';}],
  ['main/replay/adb-pull-trip-change-parent-confirmation.json', row => {row.completed = false;}],
  ['chat/local-chat-network-ui.json', row => {row.completed = true;}],
  ['main/disposable-store-restore.json', row => {row.verified = false;}],
]) test('the source boundary rejects rehashed contradictory ' + file, t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-c84-checks-')); t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, c84ChecksFolder); cpSync(resolve(root, c84ChecksFolder), folder, {recursive: true});
  assert.doesNotThrow(() => validateC84Checks(temporary));
  const path = resolve(folder, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  const sha = input => createHash('sha256').update(input).digest('hex'); hashes[file] = sha(bytes);
  const provenance = JSON.parse(readFileSync(resolve(folder, 'archive-verification.json')));
  if (provenance.members[file]) provenance.members[file].sha256 = hashes[file];
  const index = JSON.stringify(provenance); writeFileSync(resolve(folder, 'archive-verification.json'), index);
  hashes['archive-verification.json'] = sha(index);
  writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify(hashes));
  assert.throws(() => validateC84Checks(temporary));
});
