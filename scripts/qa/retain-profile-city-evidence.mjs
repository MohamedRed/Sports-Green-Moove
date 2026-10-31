import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateProfileCityReports } from './profile-city-evidence.mjs';

const { values } = parseArgs({ options: Object.fromEntries(['services', 'native', 'cleanup', 'output']
  .map(key => [key, { type: 'string' }])) });
for (const key of ['services', 'native', 'cleanup', 'output']) assert(values[key], key);
const root = resolve(import.meta.dirname, '../..');
const service = JSON.parse(readFileSync(values.services)), native = JSON.parse(readFileSync(resolve(values.native, 'results.json')));
validateProfileCityReports(service, native);
const output = resolve(values.output); assert(!existsSync(output), 'Retained evidence must not overwrite a previous run');
const sources = { ...service.sourceFiles, ...native.sourceFiles };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(sources)) assert.equal(sha(readFileSync(resolve(root, file))), expected, file);
const cleanup = JSON.parse(readFileSync(values.cleanup));
for (const key of ['localPackagesAbsent', 'consoleStopAcknowledged', 'hostExited', 'deviceAbsent', 'avdDeleted', 'portsClosed'])
  assert.equal(cleanup[key], true, key);
for (const [file, expected] of Object.entries(native.screenshots))
  assert.equal(sha(readFileSync(resolve(values.native, file))), expected, file);
mkdirSync(resolve(output, 'captures'), { recursive: true });
copyFileSync(values.services, resolve(output, 'services.json'));
copyFileSync(resolve(values.native, 'results.json'), resolve(output, 'native.json'));
copyFileSync(values.cleanup, resolve(output, 'device-cleanup.json'));
for (const file of ['ProfileCityFlowTest-instrumentation.txt', 'LocalProfileCityFlowTest-instrumentation.txt', 'profile-city-device.json', 'adb-pull-profile-city.json'])
  copyFileSync(resolve(values.native, file), resolve(output, file));
for (const [file, expected] of Object.entries(native.screenshots)) {
  assert.equal(sha(readFileSync(resolve(values.native, file))), expected, file);
  copyFileSync(resolve(values.native, file), resolve(output, 'captures', file));
}
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, { recursive: true });
for (const [file, hash] of Object.entries(sources)) {
  const target = resolve(archive, hash + '.txt');
  if (!existsSync(target)) copyFileSync(resolve(root, file), target);
  assert.equal(sha(readFileSync(target)), hash);
}
writeFileSync(resolve(output, 'summary.json'), JSON.stringify({ checkedAt: native.testedAt.slice(0, 10),
  scope: 'profile-only-city-isolated-services-and-android-not-production',
  productionDeployed: false, releaseComplete: false }, null, 2) + '\n');
writeFileSync(resolve(output, 'visual-review.json'), JSON.stringify({ reviewed: false, containsRealCustomerData: false,
  published: {}, excluded: {} }, null, 2) + '\n');
// The visual review must be completed before the separate checksum/validation step.
console.log('Original isolated city evidence retained. Visual review and final checksums are still required.');
