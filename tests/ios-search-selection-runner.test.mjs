import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import test from 'node:test';
import {parseDocument} from 'yaml';

const root = resolve(import.meta.dirname, '..');
const workflow = file => parseDocument(readFileSync(resolve(root, '.github/workflows', file), 'utf8')).toJSON();
test('the selection compile remains mandatory on the Apple runner with the unchanged full screen gate', () => {
  const job = workflow('ios-mvp-verification.yml').jobs['ios-fixture-verification'];
  assert.equal(job['runs-on'], 'macos-26'); assert.equal(job['timeout-minutes'], 50);
  const index = job.steps.findIndex(row => row.name === 'Check immediate search selection invalidation');
  assert(index > 0);
  assert.deepEqual(job.steps[index], {name: 'Check immediate search selection invalidation',
    run: 'node scripts/qa/check-ios-search-selection.mjs'});
  assert(job.steps.findIndex(row => row.name === 'Run every built fixture test without rebuilding') > index);
  assert(!('continue-on-error' in job));
});
test('the web gate executes both evidence and runner contracts without an unsupported Apple compile', () => {
  const jobs = workflow('web-integration-smoke.yml').jobs;
  const selected = Object.values(jobs).flatMap(job => (job.steps ?? []).filter(row => row.name === 'Verify immediate search selection invalidation'));
  assert.deepEqual(selected, [{name: 'Verify immediate search selection invalidation',
    run: 'node --test tests/ios-search-selection.test.mjs tests/ios-search-selection-runner.test.mjs tests/ios-current-fixture-acceptance.test.mjs'}]);
  for (const job of Object.values(jobs)) for (const step of job.steps ?? []) {
    assert(!String(step.run ?? '').includes('node scripts/qa/check-ios-search-selection.mjs'));
  }
  const script = readFileSync(resolve(root, 'scripts/qa/check-ios-search-selection.mjs'), 'utf8');
  assert(script.includes("spawnSync('swiftc'"));
  assert(script.includes("assert.equal(compiler.status, 0"));
  assert(script.includes("assert.equal(result.status, 0"));
});
