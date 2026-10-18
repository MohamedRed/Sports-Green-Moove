import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function assertRealMapDisplay(display) {
  assert.equal(display?.sdkLoaded, true);
  assert.equal(display.capture, 'native-display');
  assert.equal(display.screenFile, 'local-real-map-display.png');
  assert.equal(display.regionFile, 'local-real-map-region.png');
  for (const key of ['left', 'top']) assert(Number.isInteger(display[key]) && display[key] >= 0, key);
  for (const key of ['width', 'height']) assert(Number.isInteger(display[key]) && display[key] >= 200, key);
  assert(Number.isInteger(display.samples) && display.samples > 1000);
  assert(Number.isInteger(display.colorBins) && display.colorBins >= 16 && display.colorBins <= Math.min(4096, display.samples));
  assert(Number.isFinite(display.dominantFraction) && display.dominantFraction >= 1 / display.colorBins && display.dominantFraction < 0.85);
}

export function verifyRealMapDisplayFiles(display, directory) {
  assertRealMapDisplay(display);
  assert.deepEqual(JSON.parse(readFileSync(resolve(directory, 'local-real-map-display.json'), 'utf8')), display);
  const dimensions = (file) => {
    const png = readFileSync(resolve(directory, file));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  };
  assert.deepEqual(dimensions(display.regionFile), { width: display.width, height: display.height });
  const screen = dimensions(display.screenFile);
  assert(display.left + display.width <= screen.width && display.top + display.height <= screen.height);
}
