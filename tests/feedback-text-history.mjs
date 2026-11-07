import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {assertEvidenceBundleChecksums} from '../scripts/qa/evidence-bundle-checksums.mjs';
import {assertRetainedSourceFiles} from '../scripts/qa/retained-source-evidence.mjs';
import {feedbackTextProgress} from '../partner-portal/feedback-text-progress.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), read = file => readFileSync(resolve(root, file), 'utf8');
const main = 'android/app/src/main/java/be/sportgreenmoove/app/';
test('eight component passes remain separate from four input allocation failures and the one-line fixture correction', () => {
  const folder = 'docs/release/evidence/feedback-input-width-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file)), review = json('review.json');
  assert.deepEqual(review.ordinary, {cases: 315, passed: 256, failed: 4, skipped: 55});
  assert.equal(review.passedFeedbackCases, 8); assert.equal(review.failedFeedbackCases, 4);
  assert.equal(json('job.json').id, 125716333182); assert.equal(json('job.json').conclusion, 'failure');
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(artifact.id, 13204466928); assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read(folder + 'TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['315', '4', '55']);
  const cases = suite.testcase.filter(row => row['@_classname'].endsWith('.FeedbackTextLayoutTest'));
  assert.equal(cases.length, 12); assert.equal(cases.filter(row => row.failure).length, 4);
  for (const theme of ['light', 'dark']) for (const format of ['phone', 'wide']) {
    const record = json('diagnostics/input-' + theme + '-' + format + '.json');
    assert.equal(record.assertionsPassed, false);
    const layout = record.textLayouts[0].layouts[0], expected = format === 'phone' ? [407, 744] : [139, 828];
    assert.deepEqual([layout.widthPx, layout.paragraphWidthPx], expected);
    assert.equal(layout.overflowWidth, true); assert.equal(layout.overflowHeight, false);
  }
  for (const theme of ['light', 'dark']) {
    const row = json('diagnostics/notices-' + theme + '-wide.json').textLayouts.find(row => row.tag === 'review.submission.error').layouts[0];
    assert.deepEqual([row.widthPx, row.paragraphWidthPx, row.overflowWidth, row.overflowHeight], [832, 832, false, false]);
  }
  const before = json('failed-source-files.json'), after = json('candidate-source-files.json');
  for (const files of [before, after]) assertRetainedSourceFiles(root, files);
  assert.equal(before[main + 'ui/ReviewCard.kt'], after[main + 'ui/ReviewCard.kt']);
  const testPath = 'android/app/src/androidTest/java/be/sportgreenmoove/app/ui/FeedbackTextLayoutTest.kt';
  const source = hash => read('docs/release/evidence/source-archive/' + hash + '.txt');
  assert.equal(source(after[testPath]).replace('Modifier.fillMaxWidth().sgmTestTag("feedback.material-error")',
    'Modifier.sgmTestTag("feedback.material-error")'), source(before[testPath]));
  const checks = json('checks.json'); assert.equal(checks.headRefOid, '836a3c91e0fbf2b3b20f72147ceddaf85bb76a46');
  assert(checks.statusCheckRollup.every(row => row.status === 'COMPLETED'));
  assert.equal(checks.statusCheckRollup.find(row => row.name === 'Android native UI tests').conclusion, 'FAILURE');
  assert.equal(review.candidate.testFixtureOnly, true); assert.equal(review.candidate.nativeExecuted, false);
  assert.equal(review.inputGlyphClippingEstablished, false); assert.deepEqual(review.acceptedScreenshots, []);
  for (const key of ['physicalDeviceAccepted', 'backendFlowAccepted', 'releaseAccepted']) assert.equal(review[key], false);
});
test('native diagnostics bind the finder mismatch and constrained review width without accepting the failed images', () => {
  const folder = 'docs/release/evidence/feedback-layout-diagnosis-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file)), review = json('review.json');
  assert.deepEqual(review.ordinary, {cases: 315, passed: 253, failed: 7, skipped: 55});
  assert.deepEqual(review.input, {matchingMergedNodes: 0, matchingUnmergedNodes: 1, allFourCasesAffected: true});
  for (const theme of ['light', 'dark']) {
    const diagnostic = json('diagnostics/notices-' + theme + '-wide.json');
    assert.equal(diagnostic.scope, 'pre-assertion-layout-diagnostic-not-accepted-evidence');
    assert.equal(diagnostic.assertionsPassed, false);
    const layout = diagnostic.textLayouts.find(row => row.tag === 'review.submission.error').layouts[0];
    assert.equal(layout.widthPx, 318); assert.equal(layout.overflowWidth, true); assert.equal(layout.overflowHeight, false);
    assert(layout.constraints.includes('maxWidth = 832'));
  }
  const summary = read(folder + 'layout-failure-summary.txt');
  assert.equal(summary.split("the unmerged tree contains '1' node").length - 1, 4);
  assert(summary.includes('Failed waiting for PixelCopy!'));
  assert.equal(json('job.json').conclusion, 'failure'); assert.equal(json('job.json').id, 125701975362);
  for (const stage of ['failed', 'candidate']) assertRetainedSourceFiles(root, json(stage + '-source-files.json'));
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(selection.sourceCommit, '9576678af4efb0ea45ed6fe316452aa88e6898c6');
  assert.equal(artifact.id, 13201764886); assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  for (const [member, hash] of Object.entries(selection.members)) {
    const relative = member.includes('sgm-feedback-diagnostics/') ? 'diagnostics/' + member.split('/').at(-1) : member.split('/').at(-1);
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, folder + relative))).digest('hex'), hash);
  }
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 0});
  assert.deepEqual(json('candidate-local-validation.json').jvm, {tests: 820, failures: 0, errors: 0, skipped: 0, suites: 116});
  assert.equal(review.candidate.nativeExecuted, false); assert.deepEqual(review.acceptedScreenshots, []);
  for (const key of ['physicalDeviceAccepted', 'backendFlowAccepted', 'releaseAccepted']) assert.equal(review[key], false);
});
test('the split-fixture failure and preparation stops remain incomplete on the public progress site', () => {
  const folder = 'docs/release/evidence/feedback-layout-recheck-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file));
  const review = json('review.json'); assert.deepEqual(review.ordinary, {cases: 315, passed: 254, failed: 6, skipped: 55});
  assert.equal(review.inputSplitResolvedAllFailures, false); assert.equal(review.wideFailureNode, 'review.submission.error');
  assert.equal(review.newDiagnosticCompiled, true); assert.equal(review.newDiagnosticExecuted, false);
  for (const key of ['productSourceChanged', 'measurementsOrThresholdsChanged', 'nativeLayoutsAccepted',
    'physicalDeviceAccepted', 'releaseAccepted']) assert.equal(review[key], false, key);
  assert.deepEqual(review.acceptedScreenshots, []);
  for (const stage of ['failed', 'diagnostic']) assertRetainedSourceFiles(root, json(stage + '-source-files.json'));
  for (const [file, id, failedStep] of [['native-job.json', 125687356041, 'Run Android Compose UI tests'],
    ['web-job.json', 125687357144, 'Test isolated trip history access and paging'],
    ['team-draft-job.json', 125687356797, 'Install the selected device image before reserving storage']]) {
    const job = json(file); assert.equal(job.id, id); assert.equal(job.conclusion, 'failure');
    assert.equal(job.steps.find(step => step.name === failedStep).conclusion, 'failure');
  }
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(selection.sourceCommit, '6e4ef9721a838502bb279352914a73d951ef8e96');
  assert.equal(artifact.id, 13201140045); assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  for (const [member, hash] of Object.entries(selection.members))
    assert.equal(createHash('sha256').update(read(folder + member.split('/').at(-1))).digest('hex'), hash);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read(folder + 'TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['315', '6', '55']);
  const cases = suite.testcase.filter(row => row['@_classname'].endsWith('.FeedbackTextLayoutTest'));
  assert.equal(cases.length, 12); assert.equal(cases.filter(row => row.failure).length, 6);
  assert.equal(content.updates.filter(entry => entry.source === feedbackTextProgress.source).length, 1);
  assert.equal(feedbackTextProgress.source, folder + 'README.md'); assert.equal(feedbackTextProgress.flow, 'appearance');
  assert(!/BrowserStack|Firebase|Compose|Jetpack|Playwright|Android/.test(JSON.stringify(feedbackTextProgress)));
  assert.equal(content.flows.find(flow => flow.id === 'appearance').status, 'partial');
});
test('the original four layout failures and separate primary-copy failure cannot become passing evidence', () => {
  const folder = 'docs/release/evidence/feedback-layout-attempt-2026-11-03/';
  assertEvidenceBundleChecksums(resolve(root, folder));
  const json = file => JSON.parse(read(folder + file));
  const job = json('job.json'); assert.equal(job.id, 125676799265); assert.equal(job.conclusion, 'failure');
  assert.equal(job.run_id, 41562709680);
  const selection = json('selection.json'), artifact = json('artifact.json');
  assert.equal(selection.sourceCommit, '0dce1ea8604cbf52b85fe8c16c1c7b3915027b03');
  assert.equal(artifact.workflow_run.head_sha, selection.sourceCommit); assert.equal(artifact.id, 13198720403);
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  for (const [member, hash] of Object.entries(selection.members))
    assert.equal(createHash('sha256').update(read(folder + member.split('/').at(-1))).digest('hex'), hash);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read(folder + 'TEST-guarded-components.xml')).testsuite;
  assert.deepEqual([suite['@_tests'], suite['@_failures'], suite['@_skipped']], ['311', '4', '55']);
  const rows = suite.testcase.filter(row => row['@_classname'].endsWith('.FeedbackTextLayoutTest'));
  assert.equal(rows.length, 8);
  assert.equal(rows.filter(row => row.failure && row['@_name'].includes('[notices-')).length, 4);
  assert.equal(rows.filter(row => !row.failure && row['@_name'].includes('[ride-')).length, 4);
  assert.deepEqual(json('native-suite-status.json'), {scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 1});
  const observed = json('observed-failures.json');
  assert.equal(observed.replayFailure, 'primary-copy-booking-ui-response-loss');
  for (const key of ['nativeLayoutsAccepted', 'physicalDeviceAccepted', 'releaseAccepted']) assert.equal(observed[key], false);
  for (const stage of ['failed', 'candidate']) assertRetainedSourceFiles(root, json(stage + '-source-files.json'));
  const candidate = json('candidate-review.json'); assert.equal(candidate.caseCount, 12);
  assert.equal(candidate.nativeTestApkCompiled, true); assert.equal(candidate.nativeLayoutsExecuted, false);
  assert.equal(candidate.productSourcesChanged, false); assert.equal(candidate.overflowChecksRetained, true);
  assert.equal(candidate.physicalDeviceAccepted, false); assert.equal(candidate.releaseAccepted, false);
});
