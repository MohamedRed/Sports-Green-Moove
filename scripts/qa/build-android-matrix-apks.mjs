import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { matrixPackages, ordinaryPackages, pinnedPackages, assertMatrixApkMetadata } from './android-case-apks.mjs';

export function buildAndroidMatrixApks({ root = resolve(import.meta.dirname, '../..'), env = process.env, execute = execFileSync } = {}) {
  const android = resolve(root, 'android');
  const output = resolve(android, 'app/build/outputs'), staged = resolve(output, 'matrix-apks');
  assert(!existsSync(staged), 'Use a fresh checkout for the exact prebuilt matrix APK set');
  mkdirSync(staged, { recursive: true });
  const copies = [], statusDir = resolve(output, 'store-review-screenshots'); mkdirSync(statusDir, { recursive: true });
  let status = 0;
  try {
    for (const [isolated, packages] of [[false, ordinaryPackages], [true, pinnedPackages]]) {
      execute(resolve(android, 'gradlew'), ['-p', android, ':app:assembleDebug', ':app:assembleDebugAndroidTest',
        ':qa-install-guard:assembleDebug', `-PSGM_USE_FIREBASE_EMULATOR=${isolated}`, '--no-daemon', '--max-workers=2'],
      { cwd: root, env, stdio: 'inherit', timeout: 15 * 60_000 });
      for (const [applicationId, source] of Object.entries(packages)) {
        const from = resolve(output, source), destination = resolve(output, matrixPackages[applicationId]);
        const metadataPath = resolve(dirname(from), 'output-metadata.json'), metadata = JSON.parse(readFileSync(metadataPath));
        assert.equal(metadata.applicationId, applicationId, 'The compiled test variant identity must match');
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(from, destination, { errorOnExist: true, force: false });
        cpSync(metadataPath, resolve(dirname(destination), 'output-metadata.json'), { errorOnExist: true, force: false });
        copies.push({ applicationId, isolated, sha256: createHash('sha256').update(readFileSync(destination)).digest('hex') });
      }
    }
    assertMatrixApkMetadata(android, 'full-matrix'); assert.equal(copies.length, 4);
    writeFileSync(resolve(staged, 'manifest.json'), JSON.stringify({ scope: 'four-prebuilt-matrix-apks-not-device-execution', copies }, null, 2) + '\n', { flag: 'wx' });
  } catch (failure) { status = 1; throw failure; }
  finally { writeFileSync(resolve(statusDir, 'native-build-status.json'), JSON.stringify({
    scope: 'native-build-before-device-policy-not-flow-verification', status,
  }) + '\n', { flag: 'wx' }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildAndroidMatrixApks();
