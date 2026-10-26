import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function fingerprintMedia(directory) {
  return Object.fromEntries(readdirSync(directory).sort().map(file => {
    assert(/^[a-z0-9-]+\.(jpg|mp4)$/.test(file), 'Unexpected media filename');
    return [file, createHash('sha256').update(readFileSync(resolve(directory, file))).digest('hex')];
  }));
}

export function assertMediaCurrent(directory, expected) {
  assert.deepEqual(fingerprintMedia(directory), expected, 'Media changed after build; rebuild before publishing');
}
