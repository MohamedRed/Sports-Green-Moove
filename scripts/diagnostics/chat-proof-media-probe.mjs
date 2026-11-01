import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {assertExactRgbFrames} from '../../tests/helpers/exact-rgb-frames.mjs';

export const proofImages = ['parent-confirmed', 'parent-reopened', 'driver-visible'];
export const proofMediaFolder = 'docs/release/evidence/chat-receipt-loss-phone-2026-11-01/';
export function probeProofMedia(root, {execute = execFileSync, emit = row => console.log(JSON.stringify(row))} = {}) {
  const rows = [];
  for (const name of proofImages) {
    const decoded = [];
    for (const original of [false, true]) {
      const input = (original ? 'original-session-captures/' : 'captures/') + name + '.png';
      emit({phase: 'decode-start', image: name, original});
      const bytes = execute('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', resolve(root, proofMediaFolder, input),
        ...(original ? ['-vf', 'crop=274:618:615:109:exact=1'] : []),
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {maxBuffer: 1_000_000});
      assert.equal(bytes.length, 274 * 618 * 3, 'One complete RGB frame is required');
      decoded.push(bytes); emit({phase: 'decode-complete', image: name, original, bytes: bytes.length});
    }
    assertExactRgbFrames(decoded[0], decoded[1], 274 * 618 * 3);
    rows.push({image: name, exactPixels: true, sha256: createHash('sha256').update(decoded[0]).digest('hex')});
  }
  return {scope: 'three-original-chat-crop-comparisons-not-phone-replay-or-release', comparisons: rows,
    physicalFlowAccepted: false, releaseAccepted: false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(probeProofMedia(resolve(import.meta.dirname, '../..'))));
