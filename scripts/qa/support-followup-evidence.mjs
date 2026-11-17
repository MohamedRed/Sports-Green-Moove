import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

export const supportFollowupChecks = [
  'owner-reads-only-public-status-and-own-content', 'anonymous-other-user-and-extra-owner-input-denied',
  'admin-public-reply-closes-once-with-private-note-preserved', 'changed-operation-and-stale-other-response-refused',
  'duplicate-after-newer-status-does-not-roll-back', 'same-operation-race-creates-one-reply',
  'different-response-race-requires-refresh', 'lost-post-commit-response-retries-original-without-duplicate',
  'ticket-pagination-is-complete-and-owner-scoped', 'reply-pagination-is-complete-and-report-scoped',
  'raw-report-and-reply-operation-reads-denied-to-parent', 'contradictory-public-history-is-refused-not-silently-hidden',
  'reads-do-not-write-and-protected-records-and-claims-stay-unchanged',
];
export function validateSupportFollowupReport(report) {
  assert.equal(report.projectId, 'demo-sgm-local-qa'); assert.match(report.runId, /^[a-f0-9]{32}$/);
  assert.equal(report.completed, true); assert.equal(report.scope, 'local-emulated-services-not-phone-ui');
  assert.equal(report.coverage, 'support-written-replies-private-admin-notes');
  assert.deepEqual(report.checks.map(row => row.id), supportFollowupChecks);
  assert(report.checks.every(row => row.status === 'passed'));
  assert.equal(report.nativeUi, false); assert.equal(report.physicalDevice, false);
  assert.equal(report.pushDeliveryVerified, false); assert.equal(report.productionWrites, false);
  assert.equal(report.adminClientClosed, true); assert.equal(report.protectedRecordCount, 19);
  assert.equal(report.browser.scope, 'local-admin-browser-not-requester-native-or-phone');
  assert.equal(report.browser.checks.length, 5); assert(report.browser.checks.every(row => row.status === 'passed'));
  assert.equal(new Set(report.browser.checks.map(row => row.id)).size, 5);
  assert.deepEqual(report.browser.viewports, [1440, 768, 390, 320]);
  assert.equal(report.browser.externalRequests, 0); assert.equal(report.browser.productionWrites, false);
  assert.deepEqual(report.browser.screenshots, ['support-response-1440.png', 'support-response-768.png', 'support-response-390.png',
    'support-response-320.png', 'support-response-confirmed-mobile.png']);
  assert.equal(report.testedAt.slice(0, 10), '2026-10-22'); return report;
}
export function validateSupportFollowup(root, source) {
  const path = resolve(root, source); assert(path.startsWith(resolve(root) + sep));
  const directory = dirname(path), read = file => readFileSync(resolve(directory, file));
  const report = validateSupportFollowupReport(JSON.parse(readFileSync(path)));
  const hashes = JSON.parse(read('artifact-sha256.json'));
  assert(Object.hasOwn(hashes, 'results.json')); assert(Object.keys(hashes).length >= 30);
  for (const [file, digest] of Object.entries(hashes)) {
    assert(resolve(directory, file).startsWith(directory + sep)); assert.match(digest, /^[a-f0-9]{64}$/);
    assert.equal(createHash('sha256').update(read(file)).digest('hex'), digest, `Changed support artifact: ${file}`);
  }
  for (const file of report.browser.screenshots) {
    assert(Object.hasOwn(hashes, 'screens/' + file)); assert.equal(read('screens/' + file).subarray(1, 4).toString(), 'PNG');
  }
  const sources = JSON.parse(read('source-map.json'));
  assert.match(sources.baseCommit, /^[a-f0-9]{40}$/); assert(sources.sources.length >= 20);
  for (const row of sources.sources) { assert.equal(row.file, 'source/' + row.path); assert.equal(hashes[row.file], row.sha256); }
  return report;
}
