import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export const sdkImagePreparationFolder = 'docs/release/evidence/sdk-image-preparation-8b53925-2026-10-26/';
export function validateSdkImagePreparation(root) {
  const folder = resolve(root, sdkImagePreparationFolder); assertEvidenceBundleChecksums(folder);
  const job = JSON.parse(readFileSync(resolve(folder, 'original-job.json')));
  assert.equal(job.head_sha, '8b53925d55c7a450a0c4bc6d5ae124154a0e1265');
  assert.equal(job.id, 121884714747); assert.equal(job.run_id, 40411981666);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  const compilation = job.steps.find(row => row.name === 'Compile isolated app before starting the device');
  const preparation = job.steps.find(row => row.name === 'Run one isolated safety flow on its own phone');
  assert.equal(compilation.conclusion, 'success'); assert.equal(preparation.conclusion, 'failure');
  assert(compilation.number < preparation.number); assert(compilation.completed_at <= preparation.started_at);
  const excerpt = readFileSync(resolve(folder, 'preparation-excerpt.txt'), 'utf8');
  assert.match(excerpt, /Installing system images/);
  assert.match(excerpt, /system-images;android-35;google_apis_playstore;x86_64/);
  assert.match(excerpt, /Error on ZipFile unknown archive/);
  assert.match(excerpt, /could not connect to TCP port 5554: Connection refused/);
  assert.match(excerpt, /The process '\/usr\/bin\/sh' failed with exit code 1/);
  assert.doesNotMatch(excerpt, /INSTRUMENTATION_STATUS|INSTRUMENTATION_RESULT|OK \(\d+ tests?\)/);
  return { scope: 'failed-sdk-image-preparation-not-session-disconnect-ui', compilationPassed: true,
    preparationPassed: false, flowAssertionsAccepted: false, emulatorLaunchObserved: false,
    archiveBytesRetained: false, downloadFailureRootCauseEstablished: false, releaseAccepted: false };
}
