import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateBoundedValidation(root, record) {
  const base = dirname(resolve(root, record.source)), bytes = name => readFileSync(resolve(base, name));
  const json = name => JSON.parse(bytes(name)), report = json('summary.json');
  assert.equal(record.checkedAt, report.checkedAt); assert.equal(record.checkedAt, '2026-10-24');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  assert.equal(report.scope, 'bounded-schema-validation-work-not-production-exploit-or-whole-security-clearance');
  assert.equal(report.beforeVersion, '4.4.3'); assert.equal(report.afterVersion, '4.6.7');
  assert.equal(json('before-tree.json').dependencies['@sports-green-moove/functions'].dependencies.zod.version, report.beforeVersion);
  assert.equal(json('after-tree.json').dependencies['@sports-green-moove/functions'].dependencies.zod.version, report.afterVersion);
  assert.equal(json('functions-package.json').dependencies.zod, '^4.6.6');
  const before = json('before-audit.json'), after = json('after-audit.json');
  assert(before.vulnerabilities.zod.via.some(item => item.url === 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'));
  assert.equal(after.vulnerabilities.zod, undefined); assert(after.metadata.vulnerabilities.total > 0);
  assert.match(bytes('red.txt').toString(), /3 failed \| 1 passed \(4\)/);
  assert.match(bytes('green.txt').toString(), /4 passed \(4\)/);
  assert.match(bytes('backend-units.txt').toString(), /440 passed \(440\)/);
  assert.equal(createHash('sha256').update(bytes('bounded-collection-validation.test.ts')).digest('hex'), report.testSha256);
  assert.equal(report.unchangedTestFile, true); assert.equal(report.backendUnitCasesPassed, 440);
  const lifecycle = json('admin-lifecycle.json'); assert.equal(lifecycle.completed, true);
  assert.equal(lifecycle.isolatedEnvironmentDestroyed, true); assert.equal(lifecycle.emulatorEndpoints.closed, true);
  assert.equal(lifecycle.cases.length, 3); assert.equal(lifecycle.cases[0].observation.incompleteClientCleanupReproduced, true);
  for (const row of lifecycle.cases.slice(1)) assert.equal(row.observation.naturalExitObserved, true);
  const services = json('services.json'); assert.equal(services.projectId, 'demo-sgm-local-qa');
  assert.equal(services.steps.length, 24); assert(services.steps.every(row => row.status === 'passed'));
  assert.equal(report.localServiceGroupsPassed, 24); assert.equal(report.emulatorEndpoints.closed, true);
  for (const key of ['productionExploitReproduced', 'outOfMemoryAttackExecuted', 'securityAuditClear', 'productionDeployed',
    'physicalDeviceAccepted', 'nativeReplayAccepted', 'releaseComplete']) assert.equal(report[key], false, key);
  assertEvidenceBundleChecksums(base); return report;
}
