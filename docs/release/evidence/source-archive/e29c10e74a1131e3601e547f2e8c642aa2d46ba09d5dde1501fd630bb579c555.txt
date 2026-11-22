import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';

export const rejectedBitmapScope = 'rejected-primary-bitmap-diagnostic-not-accepted-evidence';
const keys = ['schemaVersion', 'scope', 'captureName', 'imageFile', 'imageSha256', 'width', 'height', 'sampleStride',
  'minimumDistinctSampledColorsExclusive', 'sampledColorCount', 'sampledColorsArgb', 'imageAccepted', 'flowVerified',
  'replacementCaptureUsed', 'recordedAtEpochMillis'];
export function validateRejectedPrimaryBitmaps(directory) {
  const entries = readdirSync(directory, {withFileTypes: true});
  assert(entries.length > 0 && entries.length <= 16 && entries.every(entry => entry.isFile()));
  const names = entries.map(entry => entry.name).sort();
  assert(names.every(name => /^team-chat-confirmed-[0-9]{1,20}\.(?:png|json)$/.test(name)));
  const markers = names.filter(name => name.endsWith('.json')); assert.equal(names.length, markers.length * 2);
  for (const name of markers) {
    const bytes = readFileSync(resolve(directory, name)); assert(bytes.length <= 16_384);
    const marker = JSON.parse(bytes); assert.deepEqual(Object.keys(marker).sort(), [...keys].sort());
    assert.equal(marker.schemaVersion, 1); assert.equal(marker.scope, rejectedBitmapScope);
    assert.equal(marker.captureName, 'team-chat-confirmed.png');
    assert.equal(marker.imageFile, name.replace(/\.json$/, '.png'));
    for (const key of ['imageAccepted', 'flowVerified', 'replacementCaptureUsed']) assert.equal(marker[key], false, key);
    assert.equal(marker.sampleStride, 16); assert.equal(marker.minimumDistinctSampledColorsExclusive, 16);
    assert(Number.isInteger(marker.sampledColorCount) && marker.sampledColorCount >= 1 && marker.sampledColorCount <= 16);
    assert.equal(marker.sampledColorsArgb.length, marker.sampledColorCount);
    assert(marker.sampledColorsArgb.every(color => /^[a-f0-9]{8}$/.test(color)));
    assert.deepEqual([...new Set(marker.sampledColorsArgb)].sort(), marker.sampledColorsArgb);
    assert(Number.isSafeInteger(marker.recordedAtEpochMillis) && marker.recordedAtEpochMillis > 0);
    for (const key of ['width', 'height']) assert(Number.isInteger(marker[key]) && marker[key] > 0 && marker[key] <= 8192);
    const image = readFileSync(resolve(directory, marker.imageFile));
    assert(image.length >= 24 && image.length <= 20 * 1024 * 1024);
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), marker.width); assert.equal(image.readUInt32BE(20), marker.height);
    assert.equal(createHash('sha256').update(image).digest('hex'), marker.imageSha256);
  }
  return {pairCount: markers.length, containerHeaderAndDigestVerified: true,
    pixelsIndependentlyDecoded: false, imageAccepted: false, flowVerified: false};
}

export function collectRejectedPrimaryBitmaps({adb, serial, directory, packageName = 'be.sportgreenmoove.app'}, spawn = spawnSync) {
  assert.equal(process.env.SGM_LOCAL_DISPOSABLE_EMULATOR, 'true');
  assert.equal(process.env.SGM_PRIMARY_CAPTURE_DIAGNOSTICS, 'true');
  assert.match(serial, /^emulator-\d+$/); assert(isAbsolute(directory));
  assert(['be.sportgreenmoove.app', 'be.sportgreenmoove.app.local'].includes(packageName));
  const target = resolve(directory, 'rejected-primary-captures'), receiptPath = resolve(directory, 'rejected-primary-copy.json');
  assert(!existsSync(target) && !existsSync(receiptPath), 'Rejected diagnostics cannot overwrite an earlier attempt');
  const remote = `/sdcard/Android/data/${packageName}/files/rejected-primary-captures`;
  const options = {encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024, stdio: ['ignore', 'pipe', 'pipe']};
  const receipt = {scope: 'rejected-primary-diagnostic-copy-not-flow-proof', packageName,
    sourceDirectoryObserved: false, copyAttempted: false, copyCompleted: false, validatedPairCount: 0,
    imageAccepted: false, flowVerified: false, replacementCaptureUsed: false, collectionStatus: 'failed', errorCode: null};
  try {
    const probe = spawn(adb, ['-s', serial, 'shell', 'test', '-d', remote], options);
    if (probe.error || probe.signal || ![0, 1].includes(probe.status) || String(probe.stderr ?? '').trim())
      throw new Error('DIRECTORY_CHECK_FAILED');
    if (probe.status === 1) receipt.collectionStatus = 'not-observed';
    else {
      receipt.sourceDirectoryObserved = true; receipt.copyAttempted = true; mkdirSync(target);
      const copy = spawn(adb, ['-s', serial, 'pull', remote + '/.', target], {...options, timeout: 120_000});
      if (copy.error || copy.signal || copy.status !== 0) throw new Error('COPY_FAILED');
      receipt.copyCompleted = true;
      try {receipt.validatedPairCount = validateRejectedPrimaryBitmaps(target).pairCount;}
      catch {throw new Error('REJECTED_DIAGNOSTIC_INVALID');}
      receipt.collectionStatus = 'retained';
    }
  } catch (error) {
    receipt.errorCode = ['DIRECTORY_CHECK_FAILED', 'COPY_FAILED', 'REJECTED_DIAGNOSTIC_INVALID'].includes(error.message)
      ? error.message : 'DIAGNOSTIC_COMMAND_FAILED';
  }
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return receipt;
}
