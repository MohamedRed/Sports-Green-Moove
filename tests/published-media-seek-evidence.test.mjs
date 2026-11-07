import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {publishedSeekFolder as folder, validatePublishedMediaSeek} from '../scripts/qa/published-media-seek-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), reference = {source: folder + 'result.json', checkedAt: '2026-10-28', checksums: folder + 'artifact-sha256.json'};
test('the published clip plays but remains unseekable despite a fully buffered, unchanged file', () => {
  const result = validatePublishedMediaSeek(root, reference); assert.equal(result.seekConfirmed, false);
  assert.deepEqual(content.publishedMediaReview, reference);
  assert(content.publishedMediaPlayback.source !== reference.source, 'A later success cannot overwrite this failure');
});
for (const [index, mutate] of [
  value => {value.completed = true;}, value => {value.seekConfirmed = true;}, value => {value.browserClosed = false;},
  value => {value.delivery.status = 206;}, value => {value.delivery.originalBytesMatched = false;},
  value => {value.afterSeek.currentTime = 8.8;}, value => {value.afterSeek.seekable = [[0, 9.93]];},
].entries()) test('a changed media result is not relabelled as the retained seek failure: ' + index, () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-media-proof-'));
  try {
    const base = resolve(temporary, folder); cpSync(resolve(root, folder), base, {recursive: true});
    const value = JSON.parse(readFileSync(resolve(base, 'result.json'))); mutate(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(base, 'result.json'), bytes);
    const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
    hashes['result.json'] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validatePublishedMediaSeek(temporary, reference));
  } finally {rmSync(temporary, {recursive: true, force: true});}
});
