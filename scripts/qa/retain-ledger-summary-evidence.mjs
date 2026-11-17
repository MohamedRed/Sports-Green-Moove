import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const keys = ['services', 'native', 'cleanup', 'reproduction', 'old-android', 'old-ios', 'output'];
const {values} = parseArgs({options: Object.fromEntries(keys.map(key => [key, {type: 'string'}]))});
for (const key of keys) assert(values[key], key);
const root = resolve(import.meta.dirname, '../..'), output = resolve(values.output);
assert(!existsSync(output), 'Do not overwrite an earlier trial');
const services = JSON.parse(readFileSync(values.services)), native = JSON.parse(readFileSync(resolve(values.native, 'results.json')));
const reproduction = JSON.parse(readFileSync(values.reproduction));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = {...services.sourceFiles, ...native.sourceFiles};
for (const [file, hash] of Object.entries(sources)) assert.equal(sha(readFileSync(resolve(root, file))), hash, file);
mkdirSync(resolve(output, 'captures'), {recursive: true});
for (const [source, target] of [[values.services, 'services.json'], [values.cleanup, 'device-cleanup.json'],
  [values.reproduction, 'query-reproduction.json'], [resolve(values.native, 'results.json'), 'native.json']])
  copyFileSync(source, resolve(output, target));
for (const file of ['LocalLedgerHistoryFlowTest-instrumentation.txt', 'ledger-history-device.json', 'adb-pull-ledger-history.json', 'environment-cleanup.json'])
  copyFileSync(resolve(values.native, file), resolve(output, file));
for (const [file, hash] of Object.entries(native.screenshots)) {
  assert.equal(sha(readFileSync(resolve(values.native, file))), hash);
  copyFileSync(resolve(values.native, file), resolve(output, 'captures', file));
}
const archive = resolve(root, 'docs/release/evidence/source-archive'); mkdirSync(archive, {recursive: true});
for (const [file, hash] of Object.entries(sources)) {
  const target = resolve(archive, hash + '.txt'); if (!existsSync(target)) copyFileSync(resolve(root, file), target);
  assert.equal(sha(readFileSync(target)), hash);
}
const legacySources = {};
for (const [key, file] of [['old-android', 'android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidLedgerGateway.kt'],
  ['old-ios', 'ios/Sources/SportsGreenMooveApp/FirebaseImpactRewards.swift']]) {
  const hash = reproduction.sourceFiles[file]; assert.equal(sha(readFileSync(values[key])), hash);
  const target = resolve(archive, hash + '.txt'); if (!existsSync(target)) copyFileSync(values[key], target);
  assert.equal(sha(readFileSync(target)), hash); legacySources[file] = hash;
}
writeFileSync(resolve(output, 'legacy-native-source.json'), JSON.stringify(legacySources, null, 2) + '\n');
writeFileSync(resolve(output, 'summary.json'), JSON.stringify({checkedAt: native.testedAt.slice(0, 10),
  scope: 'isolated-complete-ledger-summaries-not-production', productionDeployed: false, releaseComplete: false}, null, 2) + '\n');
writeFileSync(resolve(output, 'visual-review.json'), JSON.stringify({reviewed: false, containsRealCustomerData: false,
  published: {}, excluded: {}}, null, 2) + '\n');
console.log('Original ledger receipts and captures retained. Visual review and checksums remain required.');
