import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {reviewHistoryFolder as folder, validateReviewHistoryEvidence} from '../scripts/qa/review-history-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), reference = content.reviewHistoryRecheck;
test('an unchanged 104-rating regression fails with the old handler and passes with exact candidate reads', () => {
  const after = validateReviewHistoryEvidence(root, reference); assert.equal(after.ratingsSubmitted, 106);
  const flow = content.flows.find(row => row.id === 'ratings');
  assert.equal(flow.status, 'partial'); assert.equal(content.reviewHistoryRecheck.checkedAt, '2026-10-29');
  assert.deepEqual(flow.images.slice(-4).map(row => row.file), ['ride-phone-review-prompt', 'ride-phone-reviewed', 'ride-review', 'ride-review-sent']);
  assert.match(flow.images.at(-4).alt, /23 octobre/); assert.match(flow.remaining, /iPhone/);
});
for (const [index, file, mutate] of [
  [0, 'before.json', value => {value.completed = true;}],
  [1, 'before.json', value => {value.observations[0].displayedAlreadyRatedPrompts = 0;}],
  [2, 'before.json', value => {value.execution.baselineCommit = null;}],
  [3, 'after.json', value => {value.completed = false;}],
  [4, 'after.json', value => {value.phoneUiExecuted = true;}],
  [5, 'after.json', value => {value.observations[1].displayedPrompts = 0;}],
  [6, 'after.json', value => {value.observations[2].displayedPrompts = 0;}],
  [7, 'after.json', value => {value.observations[3].authoredRatings = 106;}],
  [8, 'after.json', value => {value.isolatedEnvironmentDestroyed = false;}],
  [9, 'after.json', value => {value.productionWrites = true;}],
  [10, 'regression.json', value => {value.steps[0].status = 'failed';}],
]) test('altered review-history evidence is rejected: ' + index, () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-review-proof-'));
  try {
    const base = resolve(temporary, folder); cpSync(resolve(root, folder), base, {recursive: true});
    const value = JSON.parse(readFileSync(resolve(base, file))); mutate(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(base, file), bytes);
    const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
    hashes[file] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateReviewHistoryEvidence(temporary, reference));
  } finally {rmSync(temporary, {recursive: true, force: true});}
});
