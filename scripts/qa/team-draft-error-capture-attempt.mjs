import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamDraftErrorCaptureAttempt(root, source) {
  const folder = dirname(resolve(root, source)), read = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(read(file)), run = json(basename(source));
  assert.equal(run.scope, 'failed-draft-storage-error-component-capture-not-complete-ui-or-physical-proof');
  assert.equal(run.sourceCommit, 'eae253539b8db3fe01ece51f08ebb8b5d26b49c5');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 119345800372); assert.equal(job.run_id, 39635801559);
  assert.equal(job.head_sha, run.sourceCommit); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(run.testedAt, job.completed_at); assert.equal(artifact.id, 12365092081);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit); assert.equal(artifact.workflow_run.id, job.run_id);
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true })
    .parse(read('instrumentation-results.xml').toString()).testsuite;
  const cases = suite.testcase.filter(test => test.classname === 'be.sportgreenmoove.app.ui.TeamConversationDraftFlowTest');
  assert.equal(cases.length, 2);
  const unreadable = cases.find(test => test.name === 'anUnreadableDraftHasExplicitRetryAndNoBlankComposerOnANarrowLargeTextScreen');
  const saveError = cases.find(test => test.name === 'failedStorageKeepsTypedTextVisibleAndBlocksSendUntilAnExplicitRetry');
  assert(unreadable && !unreadable.failure && !unreadable.skipped);
  assert(saveError && !saveError.skipped); assert.match(JSON.stringify(saveError.failure), /Capture orientation does not match the tested layout/);
  assert.deepEqual(run.componentCases, { executed: 2, passed: 1, failed: 1 });
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 1, componentEvidence: 0, localReplay: 0 });
  assert.deepEqual(run.publishedCaptures, []);
  for (const key of ['correctedNativeUiVerified', 'fullNativeSuiteVerified', 'physicalDevice', 'productionWrites']) assert.equal(run[key], false);
  assertRetainedSourceFiles(root, json('source-files.json'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return run;
}
