import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const reviewHistoryFolder = 'docs/release/evidence/review-history-2026-10-29/';
export function validateReviewHistoryEvidence(root, reference) {
  assert.deepEqual(reference, {source: reviewHistoryFolder + 'after.json', checkedAt: '2026-10-29', checksums: reviewHistoryFolder + 'artifact-sha256.json'});
  const base = resolve(root, reviewHistoryFolder); assertEvidenceBundleChecksums(base);
  const read = file => JSON.parse(readFileSync(resolve(base, file)));
  const hash = file => createHash('sha256').update(readFileSync(resolve(base, file))).digest('hex');
  const before = read('before.json'), after = read('after.json');
  for (const row of [before, after]) {
    assert.equal(row.projectId, 'demo-sgm-local-qa'); assert.match(row.runId, /^[a-f0-9]{32}$/);
    assert.equal(row.scope, 'authenticated-isolated-review-history-not-phone-or-production');
    assert.equal(row.testedAt.slice(0, 10), '2026-10-29');
    for (const flag of ['productionWrites', 'phoneUiExecuted']) assert.equal(row[flag], false);
    for (const flag of ['adminClientClosed', 'firestoreClientTerminated', 'isolatedEnvironmentDestroyed']) assert.equal(row[flag], true);
    assert.equal(row.providerRequests, 0);
    assert.deepEqual(row.emulatorEndpoints, {host: '127.0.0.1', ports: [9099, 8080, 9000, 5001], closed: true});
  }
  assert.notEqual(before.runId, after.runId); assert.equal(before.completed, false); assert.equal(after.completed, true);
  assert.deepEqual(before.steps.map(row => row.status), ['passed', 'failed']);
  assert.equal(before.steps[1].id, 'submitted-reviews-do-not-reappear-beyond-the-first-100-ratings');
  assert.equal(before.steps[1].error, 'ERR_ASSERTION'); assert.equal(before.ratingsSubmitted, 104);
  assert.equal(before.observations[0].displayedAlreadyRatedPrompts, 1);
  assert.equal(before.execution.baselineCommit, '4c73caa24aa7f4bc4ee394790052db336f671425');
  assert.equal(before.execution.inboxSourceSha256, hash('before-inbox.ts.txt'));
  assert.equal(before.execution.inboxModuleSha256, hash('before-inbox.js.txt'));
  assert.equal(after.execution.baselineCommit, null);
  assert.equal(after.execution.inboxSourceSha256, hash('source/functions/src/callables/inbox.ts.txt'));
  assert.equal(after.execution.inboxModuleSha256, hash('after-inbox.js.txt'));
  assert.notEqual(before.execution.inboxSourceSha256, after.execution.inboxSourceSha256);
  assert.deepEqual(before.sourceFiles, after.sourceFiles, 'The same test controller and current runtime sources must be used');
  for (const [file, expected] of Object.entries(after.sourceFiles)) assert.equal(hash('source/' + file + '.txt'), expected);
  assert.equal(after.steps.length, 7); assert(after.steps.every(row => row.status === 'passed'));
  assert.deepEqual(after.steps.slice(0, 2).map(row => row.id), before.steps.map(row => row.id));
  assert.deepEqual(after.observations.map(row => row.phase), ['104-rated', 'new-unrated', 'other-account', 'refreshed']);
  assert.equal(after.observations[0].displayedAlreadyRatedPrompts, 0);
  assert.deepEqual(after.observations[0].displayedIds, []);
  assert.equal(after.observations[1].displayedPrompts, 1); assert.equal(after.observations[2].displayedPrompts, 27);
  assert.deepEqual(after.observations[3], {phase: 'refreshed', repeatedRefreshes: 3, displayedPrompts: 0, authoredRatings: 105});
  assert.equal(after.ratingsSubmitted, 106); assert.equal(after.protectedRecordCount, 158);
  const regression = read('regression.json'); assert.equal(regression.projectId, 'demo-sgm-local-qa');
  assert.equal(regression.steps.length, 24); assert(regression.steps.every(row => row.status === 'passed'));
  assert.deepEqual(read('disposal.json').endpoints, after.emulatorEndpoints);
  assert.match(readFileSync(resolve(base, 'units.txt'), 'utf8'), /Tests\s+501 passed \(501\)/);
  return after;
}
