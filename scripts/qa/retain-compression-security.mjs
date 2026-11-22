import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), destination = resolve(root, 'docs/release/evidence/compression-security-2026-10-31');
assert(!existsSync(destination), 'Retained security trials cannot be overwritten');
const baseHead = '986f15535b4464ef3aeefc49c7ae0dff0aa4e20e', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const logs = {build: 'build', functions: 'functions', rules: 'rules', payments: 'payments', notifications: 'notifications', 'clean-install': 'clean-install'};
for (const name of Object.values(logs)) assert(existsSync('/private/tmp/sgm-compression-' + name + '-20261031.log'));
const endpoints = await assertLocalEndpointsClosed([4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199]);
const stage = mkdtempSync(resolve(dirname(destination), '.compression-security-stage-')), files = [];
const save = (file, bytes) => {writeFileSync(resolve(stage, file), bytes, {flag: 'wx'}); files.push(file);};
const record = (file, value) => save(file, JSON.stringify(value, null, 2) + '\n');
const sanitized = path => readFileSync(path, 'utf8').replaceAll(root, '<repo>');
try {
  for (const directory of ['before', 'after', 'sources', 'compatibility']) mkdirSync(resolve(stage, directory));
  save('before/lock.json', execFileSync('git', ['show', baseHead + ':package-lock.json'], {cwd: root}));
  save('after/lock.json', readFileSync(resolve(root, 'package-lock.json')));
  save('before/audit.json', readFileSync('/private/tmp/sgm-current-audit-20261031.json'));
  save('after/audit.json', readFileSync('/private/tmp/sgm-compression-audit-after-20261031.json'));
  for (const [phase, file] of [['before', 'before'], ['after', 'after-clean']])
    save(phase + '/regression.txt', sanitized('/private/tmp/sgm-compression-' + file + '-20261031.tap'));
  for (const [name, file] of Object.entries(logs)) save('compatibility/' + name + '.txt', sanitized('/private/tmp/sgm-compression-' + file + '-20261031.log'));
  const sources = {};
  for (const path of ['tests/compression-close-security.test.mjs', 'tests/helpers/compression-close-probe.mjs']) {
    const bytes = readFileSync(resolve(root, path)); sources[path] = sha(bytes); save('sources/' + path.split('/').at(-1) + '.txt', bytes);
  }
  record('source-sha256.json', sources); record('endpoints-closed.json', endpoints);
  record('summary.json', {scope: 'isolated-cli-compression-resource-cleanup-not-production-or-release', checkedAt: '2026-10-31',
    baseHead, beforeVersion: '1.8.1', afterVersion: '1.8.2', reproducedFailures: 3, correctedPassingCases: 7,
    regressionSourcesUnchanged: true, externalRequestsInReproduction: 0, productionRuntimeChanged: false,
    productionDeployed: false, physicalDeviceAccepted: false, providerDeliveryAccepted: false,
    fullNativeGateAccepted: false, nativeInstabilityFixed: false, releaseAccepted: false, cleanAudit: false, publishedMedia: []});
  record('artifact-sha256.json', Object.fromEntries(files.map(file => [file, sha(readFileSync(resolve(stage, file)))])));
  renameSync(stage, destination); console.log(JSON.stringify({retained: destination, correctedCases: 7, releaseAccepted: false}));
} finally {rmSync(stage, {recursive: true, force: true});}
