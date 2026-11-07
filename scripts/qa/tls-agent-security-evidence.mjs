import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const tlsAgentSecurityFolder = 'docs/release/evidence/tls-agent-security-2026-10-30/';
export function validateTlsAgentSecurity(root) {
  const folder = resolve(root, tlsAgentSecurityFolder);
  const bytes = name => readFileSync(resolve(folder, name));
  const json = name => JSON.parse(bytes(name));
  const text = name => bytes(name).toString().replace(/\x1b\[[0-9;]*m/g, '');
  const hashes = json('artifact-sha256.json'); assert.equal(Object.keys(hashes).length, 32);
  for (const [path, digest] of Object.entries(hashes)) {
    assert.match(path, /^[\w.-]+(?:\/[\w.-]+)*$/); assert(!path.split('/').includes('..'));
    assert.equal(createHash('sha256').update(bytes(path)).digest('hex'), digest);
  }
  const before = json('before/lock.json'), after = json('after/lock.json');
  assert.equal(before.packages['node_modules/undici'].version, '6.26.0');
  assert.equal(after.packages['node_modules/undici'].version, '6.29.1');
  assert.deepEqual(Object.keys(after.packages), Object.keys(before.packages));
  for (const [path, entry] of Object.entries(before.packages)) if (path !== 'node_modules/undici')
    assert.deepEqual(after.packages[path], entry, `Unrelated dependency changed: ${path}`);
  assert.deepEqual({...after.packages['node_modules/undici'], version: '6.26.0',
    resolved: before.packages['node_modules/undici'].resolved, integrity: before.packages['node_modules/undici'].integrity},
  before.packages['node_modules/undici']);
  assert.equal(after.packages['node_modules/undici'].dev, true);
  assert.deepEqual(json('before/audit.json').metadata.vulnerabilities,
    {info: 0, low: 0, moderate: 18, high: 12, critical: 0, total: 30});
  assert.deepEqual(json('after/audit.json').metadata.vulnerabilities,
    {info: 0, low: 0, moderate: 18, high: 11, critical: 0, total: 29});
  assert(json('before/audit.json').vulnerabilities.undici);
  assert.equal(json('after/audit.json').vulnerabilities.undici, undefined);
  assert.match(text('before/regression.txt'), /# pass 1\n# fail 2/);
  assert.equal((text('before/regression.txt').match(/verifierCalls: 0/g) ?? []).length, 4);
  assert.match(text('after/regression.txt'), /# pass 3\n# fail 0/);
  const sources = json('before/source-sha256.json'); assert.deepEqual(json('after/source-sha256.json'), sources);
  for (const [path, digest] of Object.entries(sources)) for (const phase of ['before', 'after'])
    assert.equal(createHash('sha256').update(bytes(phase + '/' + path.split('/').at(-1) + '.txt')).digest('hex'), digest);
  for (const [file, pattern] of [['functions', /Tests\s+547 passed \(547\)/], ['rules', /Tests\s+208 passed \(208\)/],
    ['payments', /Tests\s+78 passed \(78\)/], ['notifications', /Tests\s+19 passed \(19\)/], ['clean-install', /added \d+ packages/]])
    assert.match(text('compatibility/' + file + '.txt'), pattern);
  for (const name of ['functions', 'admin', 'website']) assert(text('compatibility/build.txt').includes(`@sports-green-moove/${name}`));
  assert.deepEqual(json('endpoints-closed.json'), {host: '127.0.0.1', ports: [4400, 4500, 5001, 8080, 9000, 9099, 9150, 9199], closed: true});
  const summary = json('summary.json');
  assert.equal(summary.scope, 'isolated-cli-transport-security-not-provider-or-release');
  assert.equal(summary.baseHead, '199307ab6128a3bada97a2471d154c550bec71ae');
  assert.equal(summary.beforeVersion, '6.26.0'); assert.equal(summary.afterVersion, '6.29.1');
  assert.equal(summary.reproducedFailures, 2); assert.equal(summary.correctedPassingCases, 3);
  assert.equal(summary.externalRequestsInReproduction, 0);
  for (const key of ['productionRuntimeChanged', 'productionDeployed', 'physicalDeviceAccepted',
    'providerDeliveryAccepted', 'releaseAccepted', 'cleanAudit', 'baseNativeFailureRepaired']) assert.equal(summary[key], false);
  assert.equal(summary.baseNativeRunId, 41133722663); assert.equal(summary.baseNativeFailedJobId, 124330865782);
  const job = json('base-native-job.json'); assert.equal(job.run_id, summary.baseNativeRunId);
  assert.equal(job.head_sha, summary.baseHead); assert.equal(job.id, summary.baseNativeFailedJobId);
  assert.equal(job.status, 'completed'); assert.equal(job.conclusion, 'failure');
  assert.equal(job.steps.find(step => step.conclusion === 'failure').name, 'Run one isolated safety flow on its own phone');
  assert.match(text('base-native-preparation-excerpt.txt'), /input keyevent 82[\s\S]+exit code 255/);
  return {findingsRemaining: 29, localTlsCasesPassed: 3, releaseAccepted: false};
}
