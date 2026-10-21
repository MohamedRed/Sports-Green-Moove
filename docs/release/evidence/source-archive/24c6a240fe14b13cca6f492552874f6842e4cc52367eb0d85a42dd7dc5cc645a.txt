import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pinnedPackages } from './preinstalled-disposable-apks.mjs';

export function assertLocalApkBadging(badging, expected) {
  assert(Object.hasOwn(pinnedPackages, expected));
  const packages = badging.split(/\r?\n/).filter(line => line.startsWith('package:'));
  assert.equal(packages.length, 1);
  assert.equal(/^package: name='([^']+)'(?:\s|$)/.exec(packages[0])?.[1], expected,
    'Build isolated local APKs before preparing or mutating the disposable phone');
}
export function assertLocalApkIdentity(android, sdk, execute = execFileSync) {
  assert(typeof sdk === 'string' && sdk.startsWith('/'), 'An absolute Android SDK path is required');
  const tools = resolve(sdk, 'build-tools');
  const versions = readdirSync(tools).filter(value => /^\d+\.\d+\.\d+$/.test(value)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  assert(versions.length); const aapt = resolve(tools, versions.at(-1), 'aapt'); assert(existsSync(aapt));
  for (const [name, file] of Object.entries(pinnedPackages)) assertLocalApkBadging(execute(aapt,
    ['dump', 'badging', resolve(android, 'app/build/outputs', file)], { encoding: 'utf8', timeout: 30_000 }), name);
}
