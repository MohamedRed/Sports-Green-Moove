import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export function validateFlowCheckRecoveryEvidence(root, metadata) {
  const folder = dirname(metadata.source), read = file => readFileSync(resolve(root, folder, file));
  assert.equal(metadata.checkedAt, '2026-10-26'); assert.equal(metadata.checksums, folder + '/artifact-sha256.json');
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert.deepEqual(Object.keys(hashes).sort(), ['original-focused-preparation-job.json', 'original-native-job.json',
    'original-web-job.json', 'phone-fixture-ready.json', 'phone-runtime-cleanup.json', 'phone-session-results.json']);
  for (const [file, hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash);
  const web = JSON.parse(read('original-web-job.json')), native = JSON.parse(read('original-native-job.json'));
  const focused = JSON.parse(read('original-focused-preparation-job.json'));
  for (const job of [web, native, focused]) {
    assert.equal(job.status, 'completed'); assert.equal(job.head_sha, '82662bd8f226fceb9480432e3236d38673ed3495');
  }
  assert.equal(web.conclusion, 'cancelled'); assert(Date.parse(web.completed_at) - Date.parse(web.started_at) >= 1_800_000);
  assert.equal(web.steps.find(step => step.name === 'Test Stripe webhook flow').conclusion, 'cancelled');
  assert.equal(native.conclusion, 'success');
  assert.equal(native.steps.find(step => step.name === 'Run Android Compose UI tests').conclusion, 'success');
  assert.equal(focused.conclusion, 'failure');
  const phone = JSON.parse(read('phone-session-results.json')), fixture = JSON.parse(read('phone-fixture-ready.json'));
  assert.equal(phone.scope, 'independent-child-account-phone-records-not-ui-proof');
  assert.equal(phone.projectId, 'demo-sgm-local-qa'); assert.equal(phone.runId, fixture.runId);
  assert.deepEqual(phone.checkpoints, []); assert.equal(phone.testedAt.slice(0, 10), metadata.checkedAt);
  for (const key of ['completed', 'physicalUiProvenByThisReport', 'signupProven', 'trackingProven', 'productionWrites']) assert.equal(phone[key], false);
  for (const report of [phone, fixture]) {
    for (const key of ['adminClientClosed', 'firestoreClientTerminated']) assert.equal(report[key], true);
    assertRetainedSourceFiles(root, report.sourceFiles);
  }
  assert.equal(fixture.childAccountProvisionedByFixture, true);
  for (const key of ['accountLinkPreseeded', 'approvalCodePreseeded', 'productionWrites']) assert.equal(fixture[key], false);
  const cleanup = JSON.parse(read('phone-runtime-cleanup.json'));
  for (const key of ['processGroupExited', 'privateSessionAbsent', 'runtimeAbsent', 'endpointsClosed']) assert.equal(cleanup[key], true);
  assert.equal(cleanup.failed, false);
}
