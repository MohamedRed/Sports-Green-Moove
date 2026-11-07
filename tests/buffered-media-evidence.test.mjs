import assert from 'node:assert/strict';
import test from 'node:test';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {bufferedMediaFolder as folder, validateBufferedMediaEvidence} from '../scripts/qa/buffered-media-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..'), reference = content.publishedMediaPlayback;
test('published short excerpts play and seek at four widths without changing originals or promoting mobile readiness', () => {
  assert.equal(validateBufferedMediaEvidence(root, reference).cases.length, 20);
  assert(!content.blockers.some(row => row.id === 'published-video-seek'));
});
for (const [index, mutate] of [
  value => {value.completed = false;}, value => {value.browserClosed = false;}, value => {value.site = 'http://localhost';},
  value => {value.cases.pop();}, value => {value.cases[0].after.time = 0;}, value => {value.cases[0].before.blobSource = false;},
  value => {value.cases[0].urls.revoked--;}, value => {value.cases[0].colors = 1;},
  value => {value.media['signed-out-relaunch.mp4'].bytes = 250000;},
  value => {value.cases.find(row => row.id === 'parent-guard').mode = 'tour';},
  value => {value.implementationSha256 = {};}, value => {value.cases[0].originalDownloadUnchanged = false;},
].entries()) test('changed or incomplete playback evidence is rejected: ' + index, () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'sgm-buffered-proof-'));
  try {
    const base = resolve(temporary, folder); cpSync(resolve(root, folder), base, {recursive: true});
    const value = JSON.parse(readFileSync(resolve(base, 'result.json'))); mutate(value);
    const bytes = JSON.stringify(value); writeFileSync(resolve(base, 'result.json'), bytes);
    const hashes = JSON.parse(readFileSync(resolve(base, 'artifact-sha256.json')));
    hashes['result.json'] = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(resolve(base, 'artifact-sha256.json'), JSON.stringify(hashes));
    assert.throws(() => validateBufferedMediaEvidence(temporary, reference));
  } finally {rmSync(temporary, {recursive: true, force: true});}
});
