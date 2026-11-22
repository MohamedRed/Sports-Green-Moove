import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const bufferedMediaFolder = 'docs/release/evidence/published-buffered-video-2026-10-29/';
const media = {
  'support-submission-retry': [67043, '474cf2468709ae65c04c7d4dec5b7e97eba08a50262eaaafdf7db71e85479f9b'],
  'home-to-trips': [137157, '854c289cad41a46acbffb106a64395a9b7c931237efbdd03e51c4eb619c890b0'],
  'parent-guard': [70835, '7f0d1c559cdbadd294cfe6caae23b8c51d1395a969ff8cb99ba0d43d87ced89c'],
  'signout-action': [136440, 'f4c6fd68ad971db3cf9701a3cd550fb3fcc6cd8ee008499d8f9c35922a91b211'],
  'signed-out-relaunch': [238170, '06b94ae78e3d771a5b7e6c11a1eef4df4e8408b99bf95cdfb0724bf749950074'],
};
export function validateBufferedMediaEvidence(root, reference) {
  assert.deepEqual(reference, {source: bufferedMediaFolder + 'result.json', checkedAt: '2026-10-29',
    checksums: bufferedMediaFolder + 'artifact-sha256.json'});
  const base = resolve(root, bufferedMediaFolder); assertEvidenceBundleChecksums(base);
  const result = JSON.parse(readFileSync(resolve(base, 'result.json')));
  assert.equal(result.scope, 'short-clip-playback-not-mobile-app-or-release-proof');
  assert.equal(result.site, 'https://sports-green-moove-progress.mohamed-redha.chatgpt.site');
  assert.equal(result.observedAt.slice(0, 10), '2026-10-29');
  assert.equal(result.completed, true); assert.equal(result.browserClosed, true); assert.deepEqual(result.errors, []);
  assert.equal(result.approvedLimitBytes, 240000); assert.equal(result.assetRevision, 'ff4c91f22006deb5');
  assert.deepEqual(result.implementationSha256, {
    'assets/ff4c91f22006deb5/short-video.js': '8243a88d7f3d69ce3cc7363d955889db40de2ac062d3c074aa1d0e345dac4728',
    'assets/ff4c91f22006deb5/app.js': '6734c5587f739fcf8bd9e63d192c6fff49277652c658dfaa6a0c8138f6df1b43',
  });
  assert.deepEqual(result.media, Object.fromEntries(Object.entries(media).map(([id, [bytes, sha256]]) => [id + '.mp4', {bytes, sha256}])));
  assert.equal(result.cases.length, 20);
  const expectedCases = [1440, 768, 390, 320].flatMap(width => Object.keys(media).map(id => `${width}:${id}`));
  assert.deepEqual(result.cases.map(row => `${row.width}:${row.id}`), expectedCases);
  for (const row of result.cases) {
    const unlisted = row.id === 'parent-guard';
    assert.equal(row.mode, unlisted ? 'unlisted-asset-production-player-harness' : row.id === 'home-to-trips' ? 'gallery' : 'tour');
    assert.equal(row.originalDownloadUnchanged, !unlisted); assert(row.colors > 100);
    assert.equal(row.screenshot, `${row.id}-${row.width}.png`);
    assert(readFileSync(resolve(base, row.screenshot)).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    assert(row.urls.created > 0); assert.equal(row.urls.created, row.urls.revoked);
    assert(row.before.time > .5 && row.before.time < 2); assert.equal(row.target, 8.8);
    assert(Math.abs(row.after.time - row.target) < .1);
    for (const state of [row.before, row.after]) {
      assert.equal(state.controls, true); assert.equal(state.blobSource, true); assert.equal(state.error, null);
      assert(state.duration > 9.9 && state.duration <= 16); assert.deepEqual(state.seekable, [[0, state.duration]]);
    }
  }
  return result;
}
