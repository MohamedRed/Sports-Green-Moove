import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {XMLParser} from 'fast-xml-parser';
import {neutralTextCases, validateNeutralTextCaptureFiles, validateNeutralTextUnits} from './neutral-text-contrast-evidence.mjs';
import {assertRetainedSourceFiles} from './retained-source-evidence.mjs';

export const neutralVisualSource = 'docs/release/evidence/neutral-text-visual-2026-10-30';

export function validateNeutralTextVisualReview(root, source = neutralVisualSource) {
  assert.equal(source, neutralVisualSource);
  const directory = resolve(root, source), read = name => readFileSync(resolve(directory, name));
  const json = name => JSON.parse(read(name)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const hashes = json('artifact-sha256.json');
  const required = ['review.json', 'selection.json', 'job.json', 'artifact.json', 'TEST-guarded-components.xml',
    ...neutralTextCases.flatMap(name => ['.png', '-window.png', '.json'].map(suffix => 'captures/' + name + suffix))];
  assert.deepEqual(Object.keys(hashes).sort(), required.sort());
  for (const [file, hash] of Object.entries(hashes)) assert.equal(sha(read(file)), hash, file);
  const review = json('review.json'), job = json('job.json'), artifact = json('artifact.json'), selection = json('selection.json');
  assert.equal(review.scope, 'reviewed-neutral-text-components-not-full-app-accessibility');
  assert.equal(review.sourceCommit, 'dcd7a5e68ce860488db046bc86ea5dc0cda05593');
  assert.equal(review.sourceRun, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/41110977694');
  assert.equal(review.reviewedAt, '2026-10-30'); assert.equal(review.fontScale, 1.3); assert.equal(review.reviewedViewports, 8);
  assert.deepEqual(review.cases, neutralTextCases);
  for (const key of ['neutralTextOverlapObserved', 'physicalDevice', 'connectedFlow', 'screenReaderVerified',
    'accentContrastAccepted', 'systemInsetsAccepted', 'releaseAccepted', 'mediaEdits']) assert.equal(review[key], false, key);
  assertRetainedSourceFiles(root, review.sourceFiles);
  assert.equal(job.id, 124253008613); assert.equal(job.run_id, 41110977694);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(job.name, 'Android native UI tests');
  for (const name of ['Run Android Compose UI tests', 'Upload Android instrumentation reports'])
    assert.equal(job.steps.find(step => step.name === name)?.conclusion, 'success');
  assert.equal(artifact.id, 13004387937); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, review.sourceCommit);
  assert.equal(artifact.name, 'android-connected-ui-test-results');
  assert.equal(artifact.digest, 'sha256:' + selection.originalArchiveSha256);
  assert.equal(selection.originalArchiveSha256, '8e806c753971906cb751675cd55d3a0f2f333a9a417c72fe5c838937b4b8b914');
  assert.equal(artifact.size_in_bytes, selection.originalArchiveBytes);
  assert.equal(selection.originalArchiveRetainedPrivately, true); assert.equal(selection.selectedMembersComparedByteForByte, true);
  const members = Object.fromEntries(neutralTextCases.flatMap(name => ['.png', '-window.png', '.json'].map(suffix =>
    ['outputs/store-review-screenshots/sgm-neutral-text/' + name + suffix, hashes['captures/' + name + suffix]])));
  members['outputs/androidTest-results/connected/debug/TEST-guarded-components.xml'] = hashes['TEST-guarded-components.xml'];
  assert.deepEqual(selection.members, members);
  const suite = new XMLParser({ignoreAttributes: false}).parse(read('TEST-guarded-components.xml')).testsuite;
  const cases = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.NeutralTextLayoutTest');
  assert.deepEqual(cases.map(row => row['@_name']).sort(), neutralTextCases
    .map(name => 'neutralTextRendersInActualScreenComponents[' + name + ']').sort());
  assert(cases.every(row => !['failure', 'error', 'skipped'].some(key => Object.hasOwn(row, key))));
  const captures = validateNeutralTextCaptureFiles(resolve(directory, 'captures'));
  for (const record of captures.records) {
    assert(record.capturedAtEpochMillis >= Date.parse(job.started_at));
    assert(record.capturedAtEpochMillis <= Date.parse(job.completed_at));
  }
  return {...review, tokenMeasurements: validateNeutralTextUnits(root)};
}
