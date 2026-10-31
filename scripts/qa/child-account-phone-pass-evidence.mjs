import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { childAccountPhonePhases } from './child-account-phone-checkpoints.mjs';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function assertCompletedPairingReport(report) {
  assert.equal(report.scope, 'independent-child-account-phone-records-not-ui-proof');
  assert.equal(report.projectId, 'demo-sgm-local-qa');
  assert.equal(report.completed, true);
  for (const key of ['physicalUiProvenByThisReport', 'signupProven', 'trackingProven', 'productionWrites'])
    assert.equal(report[key], false, key);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
  assert.deepEqual(report.checkpoints.map(row => row.phase), childAccountPhonePhases);
  report.checkpoints.forEach((row, index) => {
    assert.equal(row.status, 'passed'); assert.equal(row.approved, index >= 3);
    for (const key of ['accountClaimsUnchanged', 'protectedRecordsUnchanged']) assert.equal(row[key], true);
    for (const key of ['physicalUiProvenByThisCheckpoint', 'signupProven', 'trackingProven']) assert.equal(row[key], false);
  });
}

export function validateChildAccountPhonePass(root, metadata) {
  const folder = dirname(metadata.source), read = file => readFileSync(resolve(root, folder, file));
  assert.equal(metadata.checkedAt, '2026-10-26');
  assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const manifest = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(manifest).sort(), ['README.md', 'captures/parent-approved.png',
    'fixture-ready.json', 'runtime-cleanup.json', 'session-results.json'].sort());
  for (const [file, hash] of Object.entries(manifest)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
  const report = JSON.parse(read('session-results.json')), fixture = JSON.parse(read('fixture-ready.json'));
  assertCompletedPairingReport(report);
  assert.equal(report.testedAt.slice(0, 10), metadata.checkedAt);
  assert.equal(fixture.runId, report.runId); assert.equal(fixture.projectId, report.projectId);
  assert.equal(fixture.childAccountProvisionedByFixture, true);
  for (const key of ['accountLinkPreseeded', 'approvalCodePreseeded', 'productionWrites']) assert.equal(fixture[key], false);
  for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(fixture[key], true);
  assertRetainedSourceFiles(root, report.sourceFiles); assertRetainedSourceFiles(root, fixture.sourceFiles);
  const cleanup = JSON.parse(read('runtime-cleanup.json'));
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.failed, false);
  const png = read('captures/parent-approved.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 960); assert.equal(png.readUInt32BE(20), 2142);
}
