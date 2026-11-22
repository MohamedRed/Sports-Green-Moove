import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = readFileSync(resolve(root, 'ios/Sources/SportsGreenMooveApp/ActiveRidePermissionGate.swift'), 'utf8');
const start = '    private func requestAlwaysAuthorization() async throws {';
const end = '\n    private func ensureNotificationAuthorization';
assert.equal(source.split(start).length, 2, 'Review the permission bridge extraction');
const offset = source.indexOf(start), limit = source.indexOf(end, offset);
assert(limit > offset, 'Permission bridge boundary changed');
const bridge = source.slice(offset, limit);
assert(bridge.includes('(continuation: CheckedContinuation<Void, Error>)'), 'The permission bridge must declare its Void result');
const fixture = readFileSync(resolve(root, 'tests/fixtures/ios-permission-continuation/Bridge.swift'), 'utf8');
assert.equal(fixture.split('/* ACTUAL_PERMISSION_BRIDGE */').length, 2);
const directory = mkdtempSync(resolve(tmpdir(), 'sgm-permission-bridge-'));
try {
  const copy = resolve(directory, 'Bridge.swift'), binary = resolve(directory, 'checks');
  writeFileSync(copy, fixture.replace('/* ACTUAL_PERMISSION_BRIDGE */', bridge));
  const result = spawnSync('swiftc', ['-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors',
    resolve(root, 'ios/Sources/SportsGreenMooveApp/ProviderConfigurationError.swift'), copy,
    resolve(root, 'tests/fixtures/ios-permission-continuation/main.swift'), '-o', binary],
  {cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 1024 * 1024});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const run = spawnSync(binary, [], {encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024});
  assert.equal(run.status, 0, run.stdout + run.stderr);
  process.stdout.write(run.stdout);
} finally { rmSync(directory, {recursive: true, force: true}); }
