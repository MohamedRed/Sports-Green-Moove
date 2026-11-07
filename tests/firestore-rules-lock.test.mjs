import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {parseDocument} from 'yaml';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dir = 'docs/release/evidence/rules-lock-portability-2026-11-05/';
const report = JSON.parse(read(dir + 'summary.json'));
const hashes = text => [...text.matchAll(/"((?:h1|zh):[^"\n]+)"/g)].map(row => row[1]);

test('the official Linux package hash is pinned beside the existing workstation hash, without an upgrade', () => {
  const lock = read('infra/firestore-rules/.terraform.lock.hcl');
  assert(lock.includes('version     = "7.46.2"')); assert(lock.includes('constraints = "~> 7.0"'));
  assert.deepEqual(hashes(lock), report.afterHashes);
  assert.deepEqual(report.afterHashes.filter(hash => !report.beforeHashes.includes(hash)), [report.addedLinuxHash]);
  assert(report.beforeHashes.every(hash => report.afterHashes.includes(hash)));
  assert.equal(report.afterHashes.filter(hash => hash.startsWith('h1:')).length, 2);
  assert(read(dir + 'signed-platform-lock.txt').includes('Retrieved hashicorp/google 7.46.2 for linux_amd64 (signed by HashiCorp)'));
});
test('the actual failed Linux gate and local readonly validation retain their separate outcomes', () => {
  for (const row of report.records) assert.equal(createHash('sha256').update(read(dir + row.file)).digest('hex'), row.sha256);
  assert(read(dir + 'linux-ci-failure.txt').includes('does not match any of the checksums recorded'));
  assert.equal(report.originalConclusion, 'failure'); assert.equal(report.originalRunId, 42064566618);
  assert.equal(report.localPlatform, 'darwin_arm64'); assert.equal(report.linuxCiValidationAccepted, false);
  assert.equal(JSON.parse(read(dir + 'local-validation.json')).valid, true);
  for (const key of ['readonlyInitExitCode', 'validateExitCode', 'fmtExitCode', 'cloudPlans', 'cloudApplies', 'newMedia']) assert.equal(report[key], 0);
  for (const key of ['providerUpgrade', 'checksumVerificationWeakened', 'applicationSourceChanged', 'releaseComplete']) assert.equal(report[key], false);
});
test('smoke retains real read-only validation, no credentials, no plans or applies, and explicit regression coverage', () => {
  const web = parseDocument(read('.github/workflows/web-integration-smoke.yml')).toJSON();
  const steps = Object.values(web.jobs).flatMap(job => job.steps), validation = steps.find(step => step.name === 'Validate rules configuration without cloud changes');
  assert(validation.run.includes('init -backend=false -input=false -lockfile=readonly'));
  assert(validation.run.includes('validate')); assert(validation.run.includes('fmt -check'));
  assert.doesNotMatch(validation.run, /\bplan\b|\bapply\b|\bupgrade\b|\bimport\b|secrets\.|TF_PLUGIN_CACHE_MAY_BREAK/);
  for (const event of ['push', 'pull_request']) assert(web.on[event].paths.includes('tests/firestore-rules-lock.test.mjs'));
  assert(validation.run.startsWith('node --test tests/firestore-rules-lock.test.mjs\n'));
  const guide = read('infra/firestore-rules/README.md');
  assert(guide.includes('-platform=linux_amd64 -platform=darwin_arm64')); assert(guide.includes('-lockfile=readonly'));
});
