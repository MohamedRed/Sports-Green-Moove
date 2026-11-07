import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {MAX_SHORT_CLIP_BYTES} from './src/short-video.js';

export function shortClipByteManifest(directory, excerpts) {
  return Object.fromEntries(Object.keys(excerpts).sort().map(id => {
    assert(/^[a-z0-9-]+$/.test(id) && !id.endsWith('-full'), 'Invalid short clip name');
    const file = id + '.mp4', info = statSync(resolve(directory, file));
    assert(info.isFile() && info.size > 0 && info.size <= MAX_SHORT_CLIP_BYTES, 'Short clip exceeds approved buffering size');
    return [file, info.size];
  }));
}

export function assertShortClipsCurrent(directory, excerpts, expected) {
  assert.deepEqual(shortClipByteManifest(directory, excerpts), expected, 'Short clip sizes changed after build');
}

export function fingerprintMedia(directory) {
  return Object.fromEntries(readdirSync(directory).sort().map(file => {
    assert(/^[a-z0-9-]+\.(jpg|mp4)$/.test(file), 'Unexpected media filename');
    return [file, createHash('sha256').update(readFileSync(resolve(directory, file))).digest('hex')];
  }));
}

export function assertMediaCurrent(directory, expected) {
  assert.deepEqual(fingerprintMedia(directory), expected, 'Media changed after build; rebuild before publishing');
}
