import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';
import {validateLocationClockContract} from './location-clock-contract-evidence.mjs';

const {values} = parseArgs({options: Object.fromEntries(['services', 'log', 'units', 'output'].map(key => [key, {type: 'string'}]))});
for (const key of ['services', 'log', 'units', 'output']) assert(values[key], key);
const root = resolve(import.meta.dirname, '../..'), output = resolve(values.output);
assert(!existsSync(output), 'Retain this run in a fresh directory');
const services = JSON.parse(readFileSync(values.services));
assert.equal(services.adminClientClosed, true);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unitPath = 'functions/src/__tests__/location-clock-callables.test.ts';
const unitSourceFiles = {[unitPath]: sha(readFileSync(resolve(root, unitPath)))};
const archive = resolve(root, 'docs/release/evidence/source-archive');
mkdirSync(archive, {recursive: true});
for (const [file, hash] of Object.entries({...services.sourceFiles, ...unitSourceFiles})) {
  const bytes = readFileSync(resolve(root, file)); assert.equal(sha(bytes), hash, file);
  const target = resolve(archive, hash + '.txt');
  if (!existsSync(target)) copyFileSync(resolve(root, file), target);
  assert.equal(sha(readFileSync(target)), hash);
}
const endpoints = await assertLocalEndpointsClosed([5001, 8080, 9000, 9099]);
const log = readFileSync(values.log, 'utf8');
assert.doesNotMatch(log, /Bearer\s+[\w.-]{20,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|-----BEGIN .*PRIVATE KEY/);
mkdirSync(output);
for (const [from, to] of [[values.services, 'services.json'], [values.log, 'services.log.txt'], [values.units, 'backend-unit.xml']])
  copyFileSync(from, resolve(output, to));
const write = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
write('cleanup.json', {runId: services.runId, checkedAt: new Date().toISOString(), endpoints});
write('summary.json', {checkedAt: services.testedAt.slice(0, 10), scope: 'server-clock-contract-only-not-native-tracking',
  unitSourceFiles, clientIntegrationExecuted: false, physicalGpsAccepted: false, productionDeployed: false, releaseComplete: false});
write('artifact-sha256.json', Object.fromEntries(readdirSync(output).sort().map(file => [file, sha(readFileSync(resolve(output, file)))])));
validateLocationClockContract(root, {source: resolve(output, 'summary.json'),
  checksums: resolve(output, 'artifact-sha256.json'), checkedAt: services.testedAt.slice(0, 10)});
console.log('Server clock contract retained; client integration and physical tracking remain unproven.');
