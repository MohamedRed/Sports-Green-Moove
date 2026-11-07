import assert from 'node:assert/strict';
import test from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { content } from '../partner-portal/content.mjs';
import { validateBoundedValidation } from '../scripts/qa/bounded-validation-evidence.mjs';

const record = content.boundedValidationRecheck;
test('the same bounded-collection tests reproduce excess validation work and pass after one dependency update', () => {
  const report = validateBoundedValidation(process.cwd(), record);
  assert.equal(report.backendUnitCasesPassed, 440); assert.equal(report.securityAuditClear, false);
  assert(content.updates.some(row => row.source === record.source.replace('summary.json', 'README.md')));
});
for (const key of ['unchangedTestFile', 'securityAuditClear', 'productionDeployed', 'outOfMemoryAttackExecuted', 'nativeReplayAccepted']) {
  test('validation-work evidence rejects altered ' + key, t => {
    const root = mkdtempSync(resolve(tmpdir(), 'sgm-bounded-validation-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const base = dirname(record.source); cpSync(base, resolve(root, base), { recursive: true });
    const path = resolve(root, record.source), report = JSON.parse(readFileSync(path)); report[key] = !report[key];
    writeFileSync(path, JSON.stringify(report)); assert.throws(() => validateBoundedValidation(root, record));
  });
}
