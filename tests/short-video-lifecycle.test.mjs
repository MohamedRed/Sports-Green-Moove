import assert from 'node:assert/strict';
import test from 'node:test';
import {bindShortVideo, currentShortClip, disposeShortVideo} from '../partner-portal/src/short-video.js';

function fixture() {
  const video = new EventTarget(), attributes = new Map(), statuses = [], created = [], revoked = [];
  Object.assign(video, {controls: true, pauses: 0, loads: 0, src: '',
    setAttribute(key, value) {attributes.set(key, value);},
    removeAttribute(key) {attributes.delete(key); if (key === 'src') this.src = '';},
    pause() {this.pauses++;}, load() {this.loads++;},
    ownerDocument: {createElement() {return {setAttribute(key, value) {this[key] = value;}, remove() {this.removed = true;}};}},
  });
  const caption = {append(status) {statuses.push(status);}};
  const urls = {createObjectURL(blob) {created.push(blob); return 'blob:verified-' + created.length;}, revokeObjectURL(url) {revoked.push(url);}};
  return {video, caption, urls, created, revoked, attributes, statuses};
}
test('a verified blob enables native controls only after decoding and is released exactly once', async () => {
  const f = fixture(); const binding = bindShortVideo(f.video, 'clip.mp4', f.caption, {urls: f.urls, load: async () => new Blob(['clip'])});
  assert.equal(f.video.controls, false); assert.equal(f.attributes.get('aria-busy'), 'true');
  assert.equal(await binding.ready, true); assert.equal(f.video.src, 'blob:verified-1');
  f.video.dispatchEvent(new Event('loadeddata')); assert.equal(f.video.controls, true);
  assert.equal(f.statuses[0].textContent, ''); assert.equal(f.attributes.has('aria-busy'), false);
  assert.equal(currentShortClip(), 'clip.mp4'); disposeShortVideo(); disposeShortVideo();
  assert.deepEqual(f.revoked, ['blob:verified-1']); assert.equal(f.video.pauses, 1); assert.equal(f.video.src, '');
  assert.equal(currentShortClip(), undefined); assert.equal(f.statuses[0].removed, true);
});
test('switching views aborts pending work and a late response cannot install or leak a stale URL', async () => {
  const first = fixture(), second = fixture(); let finish, signal;
  const pending = bindShortVideo(first.video, 'first.mp4', first.caption, {urls: first.urls,
    load: async (file, input) => {signal = input; return new Promise(resolve => {finish = resolve;});}});
  const next = bindShortVideo(second.video, 'second.mp4', second.caption, {urls: second.urls, load: async () => new Blob(['second'])});
  assert.equal(signal.aborted, true); finish(new Blob(['obsolete'])); assert.equal(await pending.ready, false);
  assert.equal(first.created.length, 0); assert.equal(await next.ready, true);
  assert.equal(currentShortClip(), 'second.mp4'); disposeShortVideo();
});
test('loading failure shows one public error and never uses a remote source as an automatic fallback', async () => {
  const f = fixture(); let signal;
  const binding = bindShortVideo(f.video, 'clip.mp4', f.caption, {urls: f.urls, load: async (file, input) => {
    signal = input; throw new Error('internal diagnostic must stay private');
  }});
  assert.equal(await binding.ready, false); assert.equal(signal.aborted, true); assert.equal(f.video.controls, false);
  assert.equal(f.statuses.length, 1); assert.equal(f.statuses[0].role, 'alert');
  assert.doesNotMatch(f.statuses[0].textContent, /internal/); assert.equal(f.created.length, 0); assert.equal(f.video.src, '');
  f.video.dispatchEvent(new Event('loadeddata')); assert.equal(f.video.controls, false); disposeShortVideo();
});
