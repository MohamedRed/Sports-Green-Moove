import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { assertRetainedSourceFiles } from './retained-source-evidence.mjs';

export const neutralTextCases = ['search', 'trips'].flatMap(screen => ['light', 'dark'].flatMap(theme =>
  ['phone', 'wide'].map(format => `${screen}-${theme}-${format}`)));

export function validateNeutralTextCaptureFiles(directory) {
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const dimensions = bytes => {
    assert(bytes.length > 1024); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  };
  const records = [];
  for (const name of neutralTextCases) {
    const [screen, theme, format] = name.split('-');
    const marker = JSON.parse(readFileSync(resolve(directory, name + '.json')));
    assert.equal(marker.scope, 'executed-local-neutral-text-components-not-full-app-or-physical');
    assert.equal(marker.case, name); assert.equal(marker.screen, screen); assert.equal(marker.dark, theme === 'dark');
    assert.equal(marker.fontScale, 1.3); assert.equal(marker.physicalDevice, false); assert.equal(marker.completed, true);
    const [width, height, density] = format === 'phone' ? [320, 700, 3] : [900, 600, 1];
    assert.deepEqual([marker.widthDp, marker.heightDp, marker.density], [width, height, density]);
    assert(Number.isSafeInteger(marker.capturedAtEpochMillis) && marker.capturedAtEpochMillis > 0);
    const viewport = readFileSync(resolve(directory, name + '.png'));
    const window = readFileSync(resolve(directory, name + '-window.png'));
    assert.equal(sha(viewport), marker.viewportSha256); assert.equal(sha(window), marker.windowSha256);
    assert.deepEqual(dimensions(viewport), [width * density, height * density]);
    const [windowWidth, windowHeight] = dimensions(window);
    assert(windowWidth >= width * density && windowHeight >= height * density, 'The complete frame must fit in the actual window');
    records.push(marker);
  }
  return { scope: 'native-capture-integrity-not-visual-review-or-whole-app-accessibility', records };
}

export function validateNeutralTextUnits(root) {
  const base = resolve(root, 'docs/release/evidence/neutral-text-contrast-2026-10-20');
  const read = (stage, name) => readFileSync(resolve(base, stage, name));
  for (const stage of ['before', 'after']) {
    const hashes = JSON.parse(read(stage, 'artifact-sha256.json'));
    assert.deepEqual(Object.keys(hashes).sort(), readdirSync(resolve(base, stage)).filter(name => name !== 'artifact-sha256.json').sort());
    for (const [name, hash] of Object.entries(hashes)) {
      assert.equal(basename(name), name); assert.equal(createHash('sha256').update(read(stage, name)).digest('hex'), hash, name);
    }
  }
  const parser = new XMLParser({ ignoreAttributes: false });
  const before = parser.parse(read('before', 'contrast-failed.xml')).testsuite;
  const after = parser.parse(read('after', 'contrast-passed.xml')).testsuite;
  const expected = ['light', 'dark'].flatMap(theme => ['primary', 'secondary', 'muted'].flatMap(role =>
    ['app', 'surface', 'card', 'elevated', 'input'].map(surface => `normalTextMeetsMinimumContrast[${theme}-${role}-${surface}]`)));
  for (const suite of [before, after]) {
    assert.equal(suite['@_tests'], '30'); assert.equal(suite['@_errors'], '0'); assert.equal(suite.testcase.length, 30);
    assert.deepEqual(suite.testcase.map(row => row['@_name']).sort(), [...expected].sort());
    assert(suite.testcase.every(row => !Object.hasOwn(row, 'skipped') && !Object.hasOwn(row, 'error')));
  }
  assert.equal(before['@_failures'], '10');
  const failures = before.testcase.filter(row => Object.hasOwn(row, 'failure'));
  assert.equal(failures.length, 10); assert(failures.every(row => row['@_name'].includes('-muted-')));
  assert.equal(after['@_failures'], '0'); assert(after.testcase.every(row => !Object.hasOwn(row, 'failure')));
  const ratios = after['system-out'].trim().split('\n').map(row => JSON.parse(row));
  assert.equal(ratios.length, 30);
  assert.deepEqual(ratios.map(row => `normalTextMeetsMinimumContrast[${row.case}]`).sort(), [...expected].sort());
  assert(ratios.every(row => Number.isFinite(row.contrastRatio) && row.contrastRatio >= 4.5));
  assertRetainedSourceFiles(root, JSON.parse(read('after', 'source-sha256.json')));
  return { scope: 'neutral-text-token-units-not-whole-app-accessibility-or-layout', pairs: 30,
    originalFailures: 10, currentFailures: 0, minimumContrast: Math.min(...ratios.map(row => row.contrastRatio)) };
}
