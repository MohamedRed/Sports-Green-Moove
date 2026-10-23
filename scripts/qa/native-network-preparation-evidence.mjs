import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { assertEvidenceBundleChecksums } from './evidence-bundle-checksums.mjs';

export function validateNativeNetworkPreparation(root, record) {
  const base = dirname(resolve(root, record.source));
  assert.equal(record.checkedAt, '2026-10-23');
  assert.equal(resolve(root, record.checksums), resolve(base, 'artifact-sha256.json'));
  const run = JSON.parse(readFileSync(resolve(base, 'run.json')));
  assert.equal(run.headSha, '80c88d0c33b388fcd4d9306137146172c17fe5b8');
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'failure');
  assert.equal(run.url, 'https://github.com/MohamedRed/Sports-Green-Moove/actions/runs/39952433007');
  const focused = run.jobs.filter(job => job.name.startsWith('Android focused safety UI tests /'));
  assert.equal(focused.length, 11); assert(focused.every(job => job.conclusion === 'success'));
  assert.equal(run.jobs.find(job => job.name === 'Android native UI tests').conclusion, 'failure');
  const log = readFileSync(resolve(base, 'failure-excerpt.txt'), 'utf8');
  assert.match(log, /LocalChatNetworkFlowTest.kt:82/); assert.match(log, /ComposeTimeoutException/);
  assertEvidenceBundleChecksums(base); return run;
}
