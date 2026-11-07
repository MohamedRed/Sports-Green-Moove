import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const publishedSeekFolder = 'docs/release/evidence/published-video-seek-2026-10-28/';
export function validatePublishedMediaSeek(root, reference) {
  assert.deepEqual(reference, {source: publishedSeekFolder + 'result.json', checkedAt: '2026-10-28', checksums: publishedSeekFolder + 'artifact-sha256.json'});
  const base = resolve(root, publishedSeekFolder); assertEvidenceBundleChecksums(base);
  const result = JSON.parse(readFileSync(resolve(base, 'result.json')));
  assert.equal(result.scope, 'published-short-clip-delivery-not-mobile-app-or-release-proof');
  assert.equal(result.observedAt.slice(0, 10), '2026-10-28');
  assert.equal(result.site, 'https://sports-green-moove-progress.mohamed-redha.chatgpt.site');
  assert.deepEqual(result.viewport, {width: 1440, height: 1000});
  assert.equal(result.phase, 'seek'); assert.equal(result.errorCategory, 'browser-wait-timeout');
  for (const flag of ['seekConfirmed', 'completed', 'fallbackUsed', 'playerModified']) assert.equal(result[flag], false);
  assert.equal(result.playbackConfirmed, true); assert.equal(result.browserClosed, true); assert.equal(result.expectedSeekSeconds, 8.8);
  const delivery = result.delivery;
  assert.equal(delivery.requestedRange, 'bytes=0-15'); assert.equal(delivery.status, 200);
  assert.equal(delivery.contentType, 'video/mp4'); assert.equal(delivery.contentRange, null); assert.equal(delivery.acceptRanges, null);
  assert.equal(delivery.bytes, 67043); assert.equal(delivery.originalBytesMatched, true);
  const bytes = readFileSync(resolve(base, 'received-clip.mp4')); assert.equal(bytes.length, delivery.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), delivery.sha256);
  assert.equal(delivery.sha256, '474cf2468709ae65c04c7d4dec5b7e97eba08a50262eaaafdf7db71e85479f9b');
  assert(result.beforeSeek.currentTime > .5 && result.beforeSeek.currentTime < 1);
  assert.equal(result.beforeSeek.paused, false); assert.equal(result.afterSeek.paused, true);
  assert(result.afterSeek.currentTime < 1);
  for (const item of [result.beforeSeek, result.afterSeek]) {
    assert.equal(item.visible, true); assert.equal(item.errorCode, null); assert.equal(item.readyState, 4);
    assert(item.duration > 9.9 && item.duration < 10.1); assert.equal(item.buffered.length, 1);
    assert(item.buffered[0][1] >= item.duration - .01); assert.deepEqual(item.seekable, [[0, 0]]);
  }
  return result;
}
