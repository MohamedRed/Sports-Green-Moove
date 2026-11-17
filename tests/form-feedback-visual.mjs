import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {content, captures} from '../partner-portal/content.mjs';
import {formFeedbackVisualProgress} from '../partner-portal/form-feedback-visual-flow.mjs';
import {validateFormFeedbackAppearance} from '../partner-portal/form-feedback-appearance-evidence.mjs';
import {formFeedbackFolder} from '../scripts/qa/form-feedback-evidence.mjs';
import {formFeedbackVisualFolder, formFeedbackPublicCases, validateFormFeedbackVisualReview} from '../scripts/qa/form-feedback-visual-evidence.mjs';
import {parseDocument} from 'yaml';

const root = resolve(import.meta.dirname, '..');

test('four passed form sessions prove twenty reviewed views without accepting the failed independent network replay', () => {
  const review = validateFormFeedbackVisualReview(root);
  assert.equal(review.layoutCasesPassed, 4); assert.equal(review.viewportsReviewed, 20);
  assert.equal(review.completeViewportCaptures, 20); assert(review.minimumContrast >= 4.5);
  assert.equal(review.mainNativeJobSucceeded, false); assert.equal(review.fullNativeGateAccepted, false);
  assert.equal(review.independentReplayPassed, false); assert.equal(review.failedNetworkPhase, 'network-preparation');
  assert.equal(review.networkDisconnectionPerformed, false); assert.equal(review.releaseAccepted, false);
});

test('six original form inputs extend the gallery while every earlier image, status, phone date and tour stays unchanged', () => {
  const flow = content.flows.find(row => row.id === 'appearance');
  assert.equal(flow.status, 'partial'); assert.equal(flow.latestEvidence, 'local'); assert.equal(flow.images.length, 32);
  const previous = validateFormFeedbackAppearance(root, flow, captures); assert.equal(previous.images.length, 26);
  assert.deepEqual(flow.images.filter(image => image.file.startsWith('form-feedback-')).map(image => image.file),
    formFeedbackPublicCases.map(name => 'form-feedback-' + name));
  assert(content.updates.includes(formFeedbackVisualProgress));
  assert.equal(formFeedbackVisualProgress.source, formFeedbackVisualFolder + 'README.md');
  assert.doesNotMatch(formFeedbackVisualProgress.title + formFeedbackVisualProgress.text, /BrowserStack|Firebase|SDK|APK|CI|Kotlin|Semantics/);
  assert(!flow.images.some(image => image.file.includes('-window')));
});

test('visual form evidence cannot erase the network failure, publish comparison windows or promote broader flow claims', t => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-form-visual-scope-'));
  t.after(() => rmSync(temporary, {recursive: true, force: true}));
  const folder = resolve(temporary, formFeedbackVisualFolder); cpSync(resolve(root, formFeedbackVisualFolder), folder, {recursive: true});
  symlinkSync(resolve(root, 'docs/release/evidence/source-archive'), resolve(temporary, 'docs/release/evidence/source-archive'));
  symlinkSync(resolve(root, formFeedbackFolder), resolve(temporary, formFeedbackFolder.replace(/\/$/, '')));
  const review = JSON.parse(readFileSync(resolve(folder, 'review.json'))), hashes = JSON.parse(readFileSync(resolve(folder, 'artifact-sha256.json')));
  for (const change of [...['comparisonWindowsPublished', 'mediaEdits', 'mainNativeJobSucceeded', 'fullNativeGateAccepted',
    'independentReplayPassed', 'networkDisconnectionPerformed', 'networkFailureCauseConfirmed', 'physicalDeviceAccepted',
    'authenticationAccepted', 'searchAccepted', 'messageDeliveryAccepted', 'fullAppAccessibilityAccepted', 'releaseAccepted',
    'fallbackAdded', 'deadlineChanged', 'thresholdReduced'].map(key => ({[key]: true})),
    {publishedCaptureKind: 'window'}, {publishedCases: formFeedbackPublicCases.slice(1)}, {viewportsReviewed: 19}]) {
    const bytes = JSON.stringify({...review, ...change}); writeFileSync(resolve(folder, 'review.json'), bytes);
    writeFileSync(resolve(folder, 'artifact-sha256.json'), JSON.stringify({...hashes,
      'review.json': createHash('sha256').update(bytes).digest('hex')}));
    assert.throws(() => validateFormFeedbackVisualReview(temporary), {code: 'ERR_ASSERTION'});
  }
});

test('the existing native and web commands import visual contracts and trigger on their new module', () => {
  const testSource = readFileSync(resolve(root, 'tests/feedback-text-contrast.test.mjs'), 'utf8');
  assert(testSource.includes("import './form-feedback-visual.mjs'"));
  for (const name of ['native-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = parseDocument(readFileSync(resolve(root, '.github/workflows', name), 'utf8')).toJSON();
    for (const event of ['push', 'pull_request']) assert(workflow.on[event].paths.includes('tests/form-feedback-visual.mjs'));
    assert(Object.values(workflow.jobs).some(job => (job.steps ?? []).some(step => step.run === 'node --test tests/feedback-text-contrast.test.mjs')));
  }
});
