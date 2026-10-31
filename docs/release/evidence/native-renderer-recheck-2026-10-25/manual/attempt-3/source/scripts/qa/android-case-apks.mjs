import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const pinnedPackages = {
  'be.sportgreenmoove.app.local': 'apk/debug/app-debug.apk',
  'be.sportgreenmoove.app.local.test': 'apk/androidTest/debug/app-debug-androidTest.apk',
};
export const ordinaryPackages = {
  'be.sportgreenmoove.app': 'apk/debug/app-debug.apk',
  'be.sportgreenmoove.app.test': 'apk/androidTest/debug/app-debug-androidTest.apk',
};
export const matrixPackages = {
  'be.sportgreenmoove.app': 'matrix-apks/ordinary/app-debug.apk',
  'be.sportgreenmoove.app.test': 'matrix-apks/ordinary-test/app-debug-androidTest.apk',
  'be.sportgreenmoove.app.local': 'matrix-apks/local/app-debug.apk',
  'be.sportgreenmoove.app.local.test': 'matrix-apks/local-test/app-debug-androidTest.apk',
};
export const matrixCases = ['full-matrix'];
export const manualComponentCases = ['trip-change-components'];
export const focusedCases = ['emergency-identity', 'ride-observation', 'native-startup', 'remote-ride-stop', 'session-restoration', 'session-disconnect', 'team-conversation', 'team-access', 'team-draft', 'team-read-components'];
export function packagesForCase(name) {
  assert([...focusedCases, ...matrixCases, ...manualComponentCases, 'parent-search-booking', 'team-chat-components'].includes(name));
  if (manualComponentCases.includes(name)) return Object.fromEntries(Object.entries(matrixPackages)
    .filter(([applicationId]) => Object.hasOwn(ordinaryPackages, applicationId)));
  return name === 'full-matrix' ? matrixPackages : pinnedPackages;
}
export function assertMatrixApkMetadata(android, name) {
  assert([...matrixCases, ...manualComponentCases].includes(name));
  for (const [applicationId, file] of Object.entries(packagesForCase(name))) {
    const metadata = JSON.parse(readFileSync(resolve(android, 'app/build/outputs', dirname(file), 'output-metadata.json')));
    assert.equal(metadata.applicationId, applicationId, 'Compile the explicit matrix variant before starting the phone');
    assert.equal(metadata.artifactType.type, 'APK'); assert.equal(metadata.elements.length, 1);
    assert.equal(metadata.elements[0].type, 'SINGLE'); assert.deepEqual(metadata.elements[0].filters, []);
    assert.equal(metadata.elements[0].outputFile, file.split('/').at(-1));
  }
}
