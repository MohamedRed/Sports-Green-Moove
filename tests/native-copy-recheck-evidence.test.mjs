import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { validateNativeCopyRecheck } from '../scripts/qa/native-copy-recheck-evidence.mjs';
const root = resolve(import.meta.dirname, '..'), source = 'docs/release/evidence/native-copy-recheck-e23809a-2026-10-22/summary.json';
test('passing support components never accept a failed full evidence transfer', () => {
  const report = validateNativeCopyRecheck(root, { source }); assert.equal(report.supportComponentCases.length, 2);
  assert.equal(report.fullCiPassed, false); assert.equal(report.rootCauseEstablished, false);
});
for (const [name, file, mutate] of [
  ['whole CI success', 'summary.json', row => row.fullCiPassed = true],
  ['root cause certainty', 'summary.json', row => row.rootCauseEstablished = true],
  ['invented server exclusion', 'summary.json', row => row.processRestartExcludedAsRootCause = true],
  ['successful failed transfer', 'transfer/adb-pull-trip-change-inputs.json', row => row.completed = true],
  ['changed host process', 'transfer/adb-pull-trip-change-inputs.json', row => row.hostAfter.adbProcesses[0].pid++],
  ['promoted cleanup', 'transfer/adb-pull-failure-cleanup.json', row => row.status = 0],
  ['skipped support case', 'summary.json', row => row.supportComponentCases[0].status = 'skipped'],
]) test('rejects rehashed ' + name, () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-native-copy-evidence-'));
  try {
    cpSync(resolve(root, source, '..'), temp, { recursive: true }); const path = resolve(temp, file), row = JSON.parse(readFileSync(path));
    mutate(row); writeFileSync(path, JSON.stringify(row)); const manifest = resolve(temp, 'artifact-sha256.json');
    const hashes = JSON.parse(readFileSync(manifest)); hashes[file] = createHash('sha256').update(readFileSync(path)).digest('hex');
    writeFileSync(manifest, JSON.stringify(hashes)); assert.throws(() => validateNativeCopyRecheck(temp, { source: 'summary.json' }));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
