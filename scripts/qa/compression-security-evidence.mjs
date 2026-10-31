import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertEvidenceBundleChecksums} from './evidence-bundle-checksums.mjs';

export const compressionSecurityFolder = 'docs/release/evidence/compression-security-2026-10-31/';
export function validateCompressionSecurity(root) {
  const folder = resolve(root, compressionSecurityFolder), bytes = file => readFileSync(resolve(folder, file));
  const json = file => JSON.parse(bytes(file)), text = file => bytes(file).toString().replace(/\x1b\[[0-9;]*m/g, '');
  assertEvidenceBundleChecksums(folder);
  const before = json('before/lock.json'), after = json('after/lock.json'), path = 'node_modules/compression';
  assert.equal(before.packages[path].version, '1.8.1'); assert.equal(after.packages[path].version, '1.8.2');
  assert.deepEqual(Object.keys(after.packages), Object.keys(before.packages));
  for (const [name, entry] of Object.entries(before.packages)) if (name !== path) assert.deepEqual(after.packages[name], entry, name);
  assert.deepEqual({...after, packages: {}}, {...before, packages: {}});
  assert.equal(after.packages[path].dev, true); assert.equal(after.packages[path].dependencies.destroy, '1.2.0');
  assert.deepEqual(after.packages[path].dependencies, {...before.packages[path].dependencies, destroy: '1.2.0'});
  assert.deepEqual({...after.packages[path], version: before.packages[path].version, resolved: before.packages[path].resolved,
    integrity: before.packages[path].integrity, dependencies: before.packages[path].dependencies, funding: undefined},
  {...before.packages[path], funding: undefined});
  assert.equal(after.packages['node_modules/superstatic'].dependencies.compression, '^1.7.0');
  assert.equal(after.packages['node_modules/firebase-tools'].dev, true);
  assert.equal(after.packages[path].integrity, 'sha512-o8vI5RE5A6EVVOd9o41jKp41aJom+QTEO/Bx8MYNjexMo/Bv2WOjUfZr+aL0WnYSgymUy6zeguqLTsIhV0gMvQ==');
  for (const [phase, high, total] of [['before', 11, 39], ['after', 10, 38]])
    assert.deepEqual(json(phase + '/audit.json').metadata.vulnerabilities, {info: 0, low: 0, moderate: 28, high, critical: 0, total});
  assert(json('before/audit.json').vulnerabilities.compression); assert.equal(json('after/audit.json').vulnerabilities.compression, undefined);
  const first = text('before/regression.txt'); assert.match(first, /# pass 4\n# fail 3/);
  for (const [index, encoding] of [[1, 'gzip'], [3, 'deflate'], [5, 'br']])
    assert(first.includes(`not ok ${index} - the CLI-resolved ${encoding} stream closes when the client aborts a real response`));
  assert((first.match(/streamsDestroyed: false/g) ?? []).length >= 3);
  assert.match(text('after/regression.txt'), /# pass 7\n# fail 0/);
  const sources = json('source-sha256.json'); assert.deepEqual(Object.keys(sources),
    ['tests/compression-close-security.test.mjs', 'tests/helpers/compression-close-probe.mjs']);
  for (const [file, hash] of Object.entries(sources)) assert.equal(createHash('sha256').update(bytes('sources/' + file.split('/').at(-1) + '.txt')).digest('hex'), hash);
  for (const [file, count] of [['functions', 547], ['rules', 208], ['payments', 78], ['notifications-recheck', 19]])
    assert.match(text('compatibility/' + file + '.txt'), new RegExp('Tests\\s+' + count + ' passed \\(' + count + '\\)'));
  assert.match(text('compatibility/notifications.txt'), /Tests\s+1 failed \| 18 passed \(19\)/);
  assert.match(text('compatibility/notifications.txt'), /serializes concurrent acknowledgements into one read timestamp[\s\S]*Test timed out in 5000ms/);
  const originalHashes = json('compatibility/original-manifest.json'), hashes = json('artifact-sha256.json');
  for (const [file, hash] of Object.entries(originalHashes)) assert.equal(hashes[file], hash, 'Original evidence changed: ' + file);
  const recheck = json('compatibility/notification-recheck-context.json');
  assert.equal(recheck.scope, 'unchanged-isolated-notification-recheck-not-timeout-repair');
  assert.equal(recheck.originalPassed, 18); assert.equal(recheck.originalFailed, 1);
  assert.equal(recheck.recheckPassed, 19); assert.equal(recheck.recheckFailed, 0);
  for (const key of ['testTimeoutChanged', 'productCodeChanged', 'originalTimeoutFixed', 'physicalDeviceAccepted', 'releaseAccepted'])
    assert.equal(recheck[key], false, key);
  assert.deepEqual(recheck.endpoints, json('endpoints-closed.json'));
  const notificationSources = json('compatibility/notification-recheck-sources.json');
  assert.deepEqual(Object.keys(notificationSources), ['tests/notification-read-flow.test.ts', 'tests/notification-read-rules.test.ts',
    'functions/src/callables/notificationRead.ts', 'functions/src/lib/firestore.ts']);
  for (const [file, hash] of Object.entries(notificationSources))
    assert.equal(createHash('sha256').update(bytes('compatibility/' + file.split('/').at(-1) + '.txt')).digest('hex'), hash);
  assert.match(text('compatibility/clean-install.txt'), /added \d+ packages/);
  for (const name of ['functions', 'admin', 'website']) assert(text('compatibility/build.txt').includes('@sports-green-moove/' + name));
  assert.deepEqual(json('endpoints-closed.json'), {host: '127.0.0.1', ports: [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199], closed: true});
  const summary = json('summary.json'); assert.equal(summary.scope, 'isolated-cli-compression-resource-cleanup-not-production-or-release');
  assert.equal(summary.baseHead, '986f15535b4464ef3aeefc49c7ae0dff0aa4e20e');
  for (const [key, value] of Object.entries({beforeVersion: '1.8.1', afterVersion: '1.8.2', reproducedFailures: 3,
    correctedPassingCases: 7, regressionSourcesUnchanged: true, externalRequestsInReproduction: 0})) assert.equal(summary[key], value, key);
  for (const key of ['productionRuntimeChanged', 'productionDeployed', 'physicalDeviceAccepted', 'providerDeliveryAccepted',
    'fullNativeGateAccepted', 'nativeInstabilityFixed', 'releaseAccepted', 'cleanAudit']) assert.equal(summary[key], false, key);
  assert.deepEqual(summary.publishedMedia, []);
  return {findingsRemaining: 38, localCompressionCasesPassed: 7, releaseAccepted: false};
}
