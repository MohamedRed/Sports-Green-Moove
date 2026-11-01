import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {imageSize} from 'image-size';

export const sessionClip = {x: 615, y: 109, width: 274, height: 618};
export function cropDecodedSession(bytes, clip = sessionClip) {
  assert(Buffer.isBuffer(bytes) && bytes.length <= 8 * 1024 * 1024, 'Bounded original image required');
  assert(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, 'Original session bytes must be JPEG, regardless of filename');
  const decoded = jpeg.decode(bytes, {formatAsRGBA: true, colorTransform: true, tolerantDecoding: false,
    maxResolutionInMP: 2, maxMemoryUsageInMB: 64});
  assert.equal(decoded.width, 1440); assert.equal(decoded.height, 778);
  for (const key of ['x', 'y', 'width', 'height']) assert(Number.isSafeInteger(clip[key]), key);
  assert(clip.x >= 0 && clip.y >= 0 && clip.width > 0 && clip.height > 0);
  assert(clip.x + clip.width <= decoded.width && clip.y + clip.height <= decoded.height);
  const source = new PNG({width: decoded.width, height: decoded.height}); source.data = decoded.data;
  const crop = new PNG({width: clip.width, height: clip.height});
  source.bitblt(crop, clip.x, clip.y, clip.width, clip.height, 0, 0);
  return {source, crop, png: PNG.sync.write(crop, {colorType: 6})};
}
export function readSessionCrop(bytes) {
  const dimensions = imageSize(bytes); assert.equal(dimensions.type, 'png');
  assert.equal(dimensions.width, sessionClip.width); assert.equal(dimensions.height, sessionClip.height);
  return PNG.sync.read(bytes, {checkCRC: true});
}
