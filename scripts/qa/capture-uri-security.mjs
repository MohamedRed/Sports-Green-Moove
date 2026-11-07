import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '../..'), phase = process.argv[2];
assert(['before', 'after', 'before-corrected', 'after-corrected'].includes(phase));
const before = phase.startsWith('before');
const folder = resolve(root, 'docs/release/evidence/uri-security-2026-11-02', phase);
assert(!existsSync(folder), 'Original security captures cannot be overwritten'); mkdirSync(folder, {recursive: true});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => writeFileSync(resolve(folder, file), typeof value === 'string' ? value :
  JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const run = (command, args, extra = {}) => spawnSync(command, args, {cwd: root, encoding: 'utf8',
  timeout: 60_000, maxBuffer: 8 * 1024 * 1024, ...extra});
const worker = run(process.execPath, ['--max-old-space-size=64', 'tests/helpers/dependency-security-probe.mjs'],
  {input: JSON.stringify({mode: 'uri'}), env: {PATH: process.env.PATH, TMPDIR: process.env.TMPDIR}});
write('probe-command.json', {status: worker.status, signal: worker.signal, errorCode: worker.error?.code ?? null});
write('probe-output.txt', worker.stdout ?? '');
assert.ifError(worker.error); assert.equal(worker.status, 0); assert.equal(worker.signal, null);
const probe = JSON.parse(worker.stdout); write('probe.json', probe);
const regression = run(process.execPath, ['--test', 'tests/dependency-security-contract.test.mjs']);
write('regression.txt', ((regression.stdout ?? '') + (regression.stderr ?? '')).replaceAll(root, '<repo>'));
write('regression-command.json', {status: regression.status, signal: regression.signal, errorCode: regression.error?.code ?? null});
const audit = run('npm', ['audit', '--json']);
write('audit-output.txt', audit.stdout ?? '');
write('audit-command.json', {status: audit.status, signal: audit.signal, errorCode: audit.error?.code ?? null});
assert.ifError(audit.error); assert([0, 1].includes(audit.status)); assert.equal(audit.signal, null);
write('audit.json', JSON.parse(audit.stdout));
const lockBytes = readFileSync(resolve(root, 'package-lock.json')), lock = JSON.parse(lockBytes);
const others = Object.fromEntries(Object.entries(lock.packages).filter(([path]) => path !== 'node_modules/fast-uri').sort(([a], [b]) => a.localeCompare(b)));
const manifests = Object.fromEntries(['package.json', 'functions/package.json', 'admin/package.json', 'website/package.json']
  .map(path => [path, JSON.parse(readFileSync(resolve(root, path)))]));
write('lock-snapshot.json', {lockfileVersion: lock.lockfileVersion, wholeLockSha256: sha(lockBytes),
  fastUri: lock.packages['node_modules/fast-uri'], otherPackagesSha256: sha(JSON.stringify(others)),
  packageCount: Object.keys(lock.packages).length, declarationsSha256: sha(JSON.stringify(manifests)),
  consumers: Object.entries(lock.packages).filter(([, value]) => value.dependencies?.['fast-uri'])
    .map(([path, value]) => ({path, range: value.dependencies['fast-uri']}))});
write('source-sha256.json', Object.fromEntries(['tests/dependency-security-contract.test.mjs',
  'tests/helpers/dependency-security-probe.mjs', 'tests/helpers/uri-security-probe.mjs']
  .map(path => [path, sha(readFileSync(resolve(root, path)))])));
assert.ifError(regression.error); assert.equal(regression.signal, null);
assert.equal(regression.status, before ? 1 : 0);
assert.equal(probe.version, before ? '3.1.2' : '3.1.9'); assert.equal(probe.cases.length, 12);
assert.equal(probe.cases.filter(row => !row.passed).length, before ? 8 : 0);
assert(probe.cases.every(row => !row.unexpectedError)); assert.equal(probe.networkAttempts, 0);
write('complete.json', {scope: 'captured-pure-uri-security-regressions-not-production-exploit-or-release',
  phase, completed: true, installedVersion: probe.version, regressionSourceHashesRecorded: true,
  physicalDeviceAccepted: false, productionWrites: false, providerRequestsInProbe: 0, releaseAccepted: false});
console.log(JSON.stringify({phase, completed: true, version: probe.version, failedUriCases: probe.cases.filter(row => !row.passed).length}));
