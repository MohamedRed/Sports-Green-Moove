import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamDraftErrorComponents(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = file => readFile(resolve(folder, file));
  const json = file => JSON.parse(read(file)), run = json(basename(source));
  assert.equal(run.scope, 'native-draft-storage-error-components-with-simulated-failures-not-connected-or-physical-proof');
  assert.equal(run.sourceCommit, '8da690b7be967bf7e90a0de3f61d09fe181909eb');
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 119369157123); assert.equal(job.run_id, 39642435817);
  assert.equal(job.head_sha, run.sourceCommit); assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'success');
  assert.equal(run.testedAt, job.completed_at); assert.equal(artifact.id, 12366284791);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.digest, 'sha256:b130a5827c4acc0f70e7fe562b496f829e0c3342f7e3c55c1942a866e9f29f74');
  const suite = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseAttributeValue: true })
    .parse(read('instrumentation-results.xml').toString()).testsuite;
  assert.equal(suite.tests, 190); assert.equal(suite.failures, 0); assert.equal(suite.errors, 0);
  const cases = suite.testcase.filter(test => test.classname === 'be.sportgreenmoove.app.ui.TeamConversationDraftFlowTest');
  assert.deepEqual(cases.map(test => test.name).sort(), [
    'anUnreadableDraftHasExplicitRetryAndNoBlankComposerOnANarrowLargeTextScreen',
    'failedStorageKeepsTypedTextVisibleAndBlocksSendUntilAnExplicitRetry',
  ]);
  for (const test of cases) assert(!test.failure && !test.error && !test.skipped);
  assert.deepEqual(run.componentCases, { executed: 2, passed: 2, failed: 0 });
  assert.deepEqual(run.ordinarySuite, { executed: 190, failed: 0, errors: 0 });
  assert.equal(run.simulatedStorageFailures, true); assert.equal(run.nativeComponentUiVerified, true);
  for (const key of ['connectedServicesVerified', 'physicalDevice', 'productionWrites', 'notificationsVerified', 'releaseReady'])
    assert.equal(run[key], false);
  assert.deepEqual(json('native-suite-status.json'), { scope: 'native-suite-exit-status-not-flow-verification',
    ordinaryTests: 0, componentEvidence: 0, localReplay: 0 });
  const review = json('visual-review.json');
  assert.deepEqual(review.published, run.publishedCaptures);
  assert.deepEqual(run.publishedCaptures, { 'team-draft-errors-read': 'team-draft-read-error.png',
    'team-draft-errors-write': 'team-draft-write-error.png' });
  for (const file of Object.values(run.publishedCaptures)) {
    const bytes = read(file); assert(bytes.subarray(1, 4).equals(Buffer.from('PNG')));
    assert.equal(bytes.readUInt32BE(16), 840); assert.equal(bytes.readUInt32BE(20), 2400);
    assert(review.reviewedOriginals.includes(file));
  }
  assertRetainedSourceFiles(root, json('source-files.json'));
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return run;
}
