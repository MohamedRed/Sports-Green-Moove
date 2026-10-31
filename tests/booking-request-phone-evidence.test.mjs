import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { validateBookingRequestPhoneEvidence as validate } from '../scripts/qa/booking-request-phone-evidence.mjs';
import { content, captures } from '../partner-portal/content.mjs';

const flow = content.flows.find(row => row.id === 'booking'), record = flow.requestNoticePhone;
test('request phone observation stays distinct from local records and historical decision evidence', () => {
  const run = validate(process.cwd(), record.source);
  assert.equal(flow.checkedAt, '2026-10-30'); assert.equal(flow.status, 'partial');
  assert.equal(flow.decisionPhone.checkedAt, '2026-10-22');
  assert.equal(flow.requestNoticeChecks.checkedAt, '2026-10-23');
  assert.equal(run.parentRequestInUi, true); assert.equal(run.sameDeviceEndToEnd, false);
  assert.equal(record.checkedAt, '2026-10-23');
  assert.equal(flow.searchBookingPhone.checkedAt, '2026-10-24');
  for (const [id, file] of Object.entries(run.publishedCaptures)) {
    assert.equal(captures[id], dirname(record.source) + '/' + file);
    assert(flow.images.some(image => image.file === id && image.alt.includes('23 octobre')));
  }
});

for (const [name, file, mutate] of [
  ['same-device promotion', 'results.json', r => r.sameDeviceEndToEnd = true],
  ['simultaneous-device promotion', 'results.json', r => r.simultaneousDevices = true],
  ['push promotion', 'results.json', r => r.pushDeliveryProven = true],
  ['release promotion', 'results.json', r => r.releaseComplete = true],
  ['APK-byte promotion', 'results.json', r => r.installedBytesIndependentlyVerified = true],
  ['observer promoted to UI proof', 'checkpoints/session-results.json', r => r.physicalUiProven = true],
  ['missing checkpoint', 'checkpoints/session-results.json', r => r.checkpoints.pop()],
  ['empty source inventory', 'checkpoints/session-results.json', r => r.sourceFiles = {}],
  ['different run', 'checkpoints/driver-read.json', r => r.runId = 'b'.repeat(32)],
  ['read timestamp changed at return', 'checkpoints/driver-returned.json', r => {
    r.state.notices[0].data.readAt._nanoseconds += 1000000;
  }],
  ['protected record mutation', 'checkpoints/driver-read.json', r => {
    r.state.records.documents.users[0].data.name = 'Changed';
  }],
  ['unverified uninstall promoted', 'cleanup.json', r => r.phoneAppUninstallIndependentlyVerified = true],
  ['open backend', 'cleanup.json', r => r.endpoints.closed = false],
  ['open helper', 'cleanup.json', r => r.helperDirectoryRemoved = false],
]) test('rejects ' + name + ' even with updated artifact checksum', t => {
  const root = mkdtempSync(resolve(tmpdir(), 'sgm-request-phone-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = dirname(record.source), directory = resolve(root, base);
  cpSync(base, directory, { recursive: true });
  const path = resolve(directory, file), value = JSON.parse(readFileSync(path)); mutate(value);
  const bytes = JSON.stringify(value); writeFileSync(path, bytes);
  const hashPath = resolve(directory, 'artifact-sha256.json'), hashes = JSON.parse(readFileSync(hashPath));
  hashes[file] = createHash('sha256').update(bytes).digest('hex'); writeFileSync(hashPath, JSON.stringify(hashes));
  assert.throws(() => validate(root, record.source));
});

test('both CI paths execute the checkpoint and retained phone contracts', () => {
  for (const name of ['backend-ci.yml', 'web-integration-smoke.yml']) {
    const workflow = readFileSync('.github/workflows/' + name, 'utf8');
    assert(workflow.includes('tests/booking-request-phone-checkpoints.test.mjs'));
    assert(workflow.includes('tests/booking-request-phone-evidence.test.mjs'));
  }
});
