import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import test from 'node:test';
import {assertDependencyPatchSummary, validateDependencyPatchEvidence, dependencyPatchFolder as folder} from '../scripts/qa/dependency-patch-evidence.mjs';
import {content} from '../partner-portal/content.mjs';

const root = resolve(import.meta.dirname, '..');
const report = () => JSON.parse(readFileSync(resolve(root, folder, 'summary.json')));
test('unchanged dependency regressions and complete local compatibility remain independently retained', () => {
  const summary = validateDependencyPatchEvidence(root); assert.equal(summary.failuresAfter, 0);
});
for (const flag of ['productionExploitProven', 'allSecurityFindingsResolved', 'productionDeployed', 'physicalUiVerified',
  'realPayments', 'releaseComplete', 'nativeNetworkPreparationCauseProven', 'nativeFailureRepairedByDependencyPatch'])
  test('dependency maintenance cannot establish ' + flag, () => {
    const value = report(); value[flag] = true; assert.throws(() => assertDependencyPatchSummary(value));
  });
test('changed original audit data is rejected even with an unchanged summary', () => {
  const temp = mkdtempSync(resolve(tmpdir(), 'sgm-dependency-proof-'));
  try {
    cpSync(resolve(root, folder), resolve(temp, folder), {recursive: true});
    writeFileSync(resolve(temp, folder, 'audit-all-after.json'), '{}');
    assert.throws(() => validateDependencyPatchEvidence(temp));
  } finally {rmSync(temp, {recursive: true, force: true});}
});
test('public progress keeps security partial and retains the unsuccessful network preparation separately', () => {
  assert.equal(content.dependencyPatchRecheck.source, folder + '/summary.json');
  const news = content.updates.find(row => row.source === folder + '/README.md');
  assert.match(news.text, /autres alertes/); assert.doesNotMatch(news.text, /Firebase|BrowserStack|gRPC|SDK|npm|Vite|PostCSS/);
  assert(content.blockers.some(row => row.id === 'dependency-security'));
  assert(content.updates.some(row => row.source === folder + '/previous-ci/README.md'));
});
