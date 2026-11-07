import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';
import {assertLocalEndpointsClosed} from './local-emulator-lifecycle.mjs';

const root = resolve(import.meta.dirname, '../..'), folder = resolve(root, 'docs/release/evidence/compression-security-2026-10-31');
assertEvidenceBundleChecksums(folder); assert(!existsSync(resolve(folder, 'compatibility/notifications-recheck.txt')));
const log = readFileSync('/private/tmp/sgm-compression-notifications-recheck-20261031.log', 'utf8').replaceAll(root, '<repo>');
assert.match(log.replace(/\x1b\[[0-9;]*m/g, ''), /Tests\s+19 passed \(19\)/);
assert.match(log, /Script exited successfully \(code 0\)/);
const endpoints = await assertLocalEndpointsClosed([4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199]);
const index = readFileSync(resolve(folder, 'artifact-sha256.json')), hashes = JSON.parse(index);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const additions = {'compatibility/original-manifest.json': index, 'compatibility/notifications-recheck.txt': log};
const sources = {};
for (const path of ['tests/notification-read-flow.test.ts', 'tests/notification-read-rules.test.ts',
  'functions/src/callables/notificationRead.ts', 'functions/src/lib/firestore.ts']) {
  const bytes = readFileSync(resolve(root, path));
  assert.deepEqual(bytes, execFileSync('git', ['show', '986f15535b4464ef3aeefc49c7ae0dff0aa4e20e:' + path], {cwd: root}));
  sources[path] = sha(bytes); additions['compatibility/' + path.split('/').at(-1) + '.txt'] = bytes;
}
additions['compatibility/notification-recheck-sources.json'] = JSON.stringify(sources, null, 2) + '\n';
additions['compatibility/notification-recheck-context.json'] = JSON.stringify({
  scope: 'unchanged-isolated-notification-recheck-not-timeout-repair', originalPassed: 18, originalFailed: 1,
  recheckPassed: 19, recheckFailed: 0, testTimeoutChanged: false, productCodeChanged: false,
  originalTimeoutFixed: false, physicalDeviceAccepted: false, releaseAccepted: false, endpoints,
}, null, 2) + '\n';
for (const [file, bytes] of Object.entries(additions)) {
  writeFileSync(resolve(folder, file), bytes, {flag: 'wx'}); hashes[file] = sha(bytes);
}
const next = resolve(folder, '.next-index.json'); writeFileSync(next, JSON.stringify(hashes, null, 2) + '\n', {flag: 'wx'});
renameSync(next, resolve(folder, 'artifact-sha256.json')); assertEvidenceBundleChecksums(folder);
console.log(JSON.stringify({originalArtifactsPreserved: true, recheckPassed: 19, originalTimeoutFixed: false}));
