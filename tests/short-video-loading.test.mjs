import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {configureMediaRevisions} from '../partner-portal/src/media-url.js';
import {configureShortClips, loadVerifiedShortClip, MAX_SHORT_CLIP_BYTES} from '../partner-portal/src/short-video.js';
import {assertShortClipsCurrent, shortClipByteManifest} from '../partner-portal/media-assets.mjs';

const bytes = new TextEncoder().encode('verified-clip-unit-fixture-not-real-video');
const hash = createHash('sha256').update(bytes).digest('hex');
test('only media may use blob URLs; scripts and connections remain same-origin', () => {
  const html = readFileSync(new URL('../partner-portal/src/index.html', import.meta.url), 'utf8');
  const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  const directives = Object.fromEntries(policy.split(';').filter(value => value.trim()).map(value => {
    const [name, ...sources] = value.trim().split(/\s+/); return [name, sources];
  }));
  assert.deepEqual(directives['media-src'], ["'self'", 'blob:']);
  for (const name of ['script-src', 'connect-src', 'default-src']) assert.deepEqual(directives[name], ["'self'"]);
});
function setup() {configureMediaRevisions({'clip.mp4': hash, 'recording-full.mp4': hash}); configureShortClips({'clip.mp4': bytes.length});}
function response(body = bytes, headers = {'content-type': 'video/mp4'}, status = 200) {return new Response(body, {headers, status});}
test('only approved bounded excerpts may be buffered, never original recordings or unknown media', async () => {
  setup(); let calls = 0;
  for (const manifest of [null, [], {}, {'clip.mp4': 0}, {'clip.mp4': MAX_SHORT_CLIP_BYTES + 1},
    {'recording-full.mp4': bytes.length}, {'../clip.mp4': bytes.length}, {'missing.mp4': bytes.length}])
    assert.throws(() => configureShortClips(manifest));
  for (const file of ['recording-full.mp4', 'missing.mp4']) await assert.rejects(loadVerifiedShortClip(file,
    new AbortController().signal, {fetcher: () => {calls++;}}));
  assert.equal(calls, 0);
});
test('a full HTTP 200 response becomes exactly the hash-verified original MP4 blob', async () => {
  setup(); const controller = new AbortController();
  const blob = await loadVerifiedShortClip('clip.mp4', controller.signal, {fetcher: async (url, options) => {
    assert.equal(url, 'media/clip.mp4?v=' + hash); assert.equal(options.signal, controller.signal);
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'same-origin');
    assert(!options.headers); return response(bytes, {'content-type': 'video/mp4', 'content-length': String(bytes.length)});
  }});
  assert.equal(blob.type, 'video/mp4'); assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});
for (const [name, headers, status] of [['partial', {'content-type': 'video/mp4'}, 206],
  ['error', {'content-type': 'video/mp4'}, 500], ['html', {'content-type': 'text/html'}, 200],
  ['oversized', {'content-type': 'video/mp4', 'content-length': '240001'}, 200],
  ['invalid length', {'content-type': 'video/mp4', 'content-length': 'bad'}, 200]])
  test(name + ' responses stop and cancel their body without playback or alternate requests', async () => {
    setup(); let cancelled = false, calls = 0;
    const stream = new ReadableStream({cancel() {cancelled = true;}});
    await assert.rejects(loadVerifiedShortClip('clip.mp4', new AbortController().signal, {fetcher: async () => {
      calls++; return response(stream, headers, status);
    }})); assert.equal(cancelled, true); assert.equal(calls, 1);
  });
for (const [name, body] of [['overflow', new Uint8Array(bytes.length + 1)], ['truncated', bytes.subarray(1)],
  ['wrong hash', new Uint8Array(bytes.length)]]) test(name + ' bodies never become an accepted blob', async () => {
  setup(); await assert.rejects(loadVerifiedShortClip('clip.mp4', new AbortController().signal, {fetcher: async () => response(body)}));
});
test('cancellation is checked before fetching and after asynchronous integrity verification', async () => {
  setup(); const early = new AbortController(); early.abort(); let calls = 0;
  await assert.rejects(loadVerifiedShortClip('clip.mp4', early.signal, {fetcher: () => {calls++;}}), {name: 'AbortError'});
  assert.equal(calls, 0); const late = new AbortController();
  await assert.rejects(loadVerifiedShortClip('clip.mp4', late.signal, {fetcher: async () => response(),
    digest: async () => {late.abort(); return Buffer.from(hash, 'hex');}}), {name: 'AbortError'});
});
test('publication binds all excerpt sizes and rejects oversized or stale metadata', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'sgm-clip-size-'));
  try {
    writeFileSync(resolve(directory, 'clip.mp4'), bytes);
    const manifest = shortClipByteManifest(directory, {clip: {}}); assert.deepEqual(manifest, {'clip.mp4': bytes.length});
    assertShortClipsCurrent(directory, {clip: {}}, manifest);
    assert.throws(() => assertShortClipsCurrent(directory, {clip: {}}, {'clip.mp4': bytes.length + 1}));
    writeFileSync(resolve(directory, 'clip.mp4'), new Uint8Array(MAX_SHORT_CLIP_BYTES + 1));
    assert.throws(() => shortClipByteManifest(directory, {clip: {}}));
    assert.throws(() => shortClipByteManifest(directory, {'recording-full': {}}));
  } finally {rmSync(directory, {recursive: true, force: true});}
});
