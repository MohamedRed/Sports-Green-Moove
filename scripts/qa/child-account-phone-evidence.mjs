import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateChildAccountPhoneAttempt(root, metadata) {
  assert.equal(metadata.checkedAt, '2026-10-26');
  const folder = dirname(metadata.source);
  assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const read = file => readFileSync(resolve(root, folder, file));
  const checksums = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(checksums).sort(), ['attempt-1/fixture-ready.json', 'attempt-1/runtime-cleanup.json',
    'attempt-1/session-results.json', 'attempt-2/fixture-ready.json', 'attempt-2/runtime-cleanup.json',
    'attempt-2/session-results.json', 'captures/child-before-code.png', 'captures/parent-review.png'].sort());
  for (const [file, hash] of Object.entries(checksums)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
  const runIds = [];
  for (const attempt of ['attempt-1', 'attempt-2']) {
    const report = JSON.parse(read(attempt + '/session-results.json'));
    assert.equal(report.scope, 'independent-child-account-phone-records-not-ui-proof');
    assert.equal(report.projectId, 'demo-sgm-local-qa');
    assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt);
    for (const key of ['completed', 'physicalUiProvenByThisReport', 'signupProven', 'trackingProven', 'productionWrites'])
      assert.equal(report[key], false, key);
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true, key);
    assert.deepEqual(report.checkpoints.map(row => row.phase), ['child-signed-in', 'code-created', 'parent-review']);
    for (const row of report.checkpoints) {
      assert.equal(row.status, 'passed');
      for (const key of ['approved', 'physicalUiProvenByThisCheckpoint', 'signupProven', 'trackingProven']) assert.equal(row[key], false);
      for (const key of ['accountClaimsUnchanged', 'protectedRecordsUnchanged']) assert.equal(row[key], true);
    }
    const fixture = JSON.parse(read(attempt + '/fixture-ready.json'));
    assert.equal(fixture.runId, report.runId); runIds.push(report.runId);
    assert.equal(fixture.projectId, report.projectId);
    assert.equal(fixture.childAccountProvisionedByFixture, true);
    for (const key of ['accountLinkPreseeded', 'approvalCodePreseeded', 'productionWrites']) assert.equal(fixture[key], false);
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(fixture[key], true);
    assertRetainedSourceFiles(root, report.sourceFiles); assertRetainedSourceFiles(root, fixture.sourceFiles);
    const cleanup = JSON.parse(read(attempt + '/runtime-cleanup.json'));
    for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
    assert.equal(cleanup.failed, false);
  }
  assert.notEqual(runIds[0], runIds[1]);
}
