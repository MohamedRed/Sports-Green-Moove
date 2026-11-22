import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';

export const privateTrialCaptures = ['mismatch', 'created', 'child-home'];
export function cropPrivateTrialCapture(bytes, id) {
  assert(privateTrialCaptures.includes(id));
  assert(Buffer.isBuffer(bytes) && bytes.length < 2 * 1024 * 1024);
  const decoded = jpeg.decode(bytes, {formatAsRGBA: true, tolerantDecoding: false,
    maxResolutionInMP: 2, maxMemoryUsageInMB: 64});
  assert.equal(decoded.width, 1440); assert.equal(decoded.height, 900);
  const y = id === 'child-home' ? 149 : 193, height = 828 - y;
  const source = new PNG({width: 1440, height: 900}); source.data = decoded.data;
  const crop = new PNG({width: 330, height}); source.bitblt(crop, 586, y, 330, height, 0, 0);
  return PNG.sync.write(crop, {colorType: 6});
}
