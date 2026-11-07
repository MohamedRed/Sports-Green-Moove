import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateTeamReadComponentAttempt(root, source, readFile = readFileSync) {
  const folder = dirname(resolve(root, source)), read = name => readFile(resolve(folder, name));
  const json = name => JSON.parse(read(name)), run = json(basename(source));
  assert.equal(run.scope, 'failed-team-read-components-not-accepted-ui-or-release-proof');
  assert.equal(run.completed, false); assert.equal(run.nativeUiExecuted, true);
  for (const key of ['physicalDevice', 'notificationsVerified', 'productionWrites']) assert.equal(run[key], false);
  assert.deepEqual(run.publishedCaptures, []);
  const job = json('job.json'), artifact = json('artifact.json');
  assert.equal(job.id, 119445166811); assert.equal(job.run_id, 39664309659);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(run.testedAt, job.completed_at);
  assert.equal(run.sourceCommit, '6b1aa3af75b5757f567cf2eb793e75c09b55ef70');
  assert.equal(artifact.id, 12378083242); assert.equal(artifact.workflow_run.id, job.run_id);
  assert.equal(artifact.workflow_run.head_sha, run.sourceCommit);
  const suite = new XMLParser({ ignoreAttributes: false }).parse(read('suite.xml')).testsuite;
  assert.equal(Number(suite['@_tests']), 193); assert.equal(suite.testcase.length, 193);
  assert.equal(Number(suite['@_failures']), 3);
  assert.equal(suite.testcase.filter(row => Object.hasOwn(row, 'skipped')).length, 50);
  const cases = suite.testcase.filter(row => row['@_classname'] === 'be.sportgreenmoove.app.ui.TeamConversationReadFlowTest');
  assert.equal(cases.length, 3);
  assert.deepEqual(run.componentCases, cases.map(row => ({ id: row['@_name'], status: Object.hasOwn(row, 'failure') ? 'failed' : 'passed' })));
  const failures = cases.filter(row => Object.hasOwn(row, 'failure')); assert.equal(failures.length, 2);
  for (const row of failures) assert.match(row.failure, /unmerged tree contains '1' node that matches/);
  const restored = json('device-restored.json'); assert.equal(restored.verified, true); assert.equal(restored.restored, true);
  for (const key of ['authorizationRemoved', 'componentRemoved', 'originalPolicyRestored']) assert.equal(restored.installAdmin[key], true);
  assert.equal(json('native-suite-status.json').ordinaryTests, 1);
  assert.equal(json('native-suite-status.json').localReplay, 0);
  assertRetainedSourceFiles(root, run.sourceFiles);
  for (const [file, hash] of Object.entries(json('artifact-sha256.json'))) {
    assert.equal(basename(file), file); assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash, file);
  }
  return run;
}
