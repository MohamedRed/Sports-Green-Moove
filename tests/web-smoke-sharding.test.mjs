import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseDocument } from 'yaml';
import { fileURLToPath } from 'node:url';
import { validateFlowCheckRecoveryEvidence } from '../scripts/qa/flow-check-recovery-evidence.mjs';
import { childPhoneStartupAttempt } from '../partner-portal/progress-2026-10-26.mjs';

const file = new URL('../.github/workflows/web-integration-smoke.yml', import.meta.url);
const workflow = parseDocument(readFileSync(file, 'utf8')).toJSON();
const setup = new Set(['Install dependencies', 'Build Functions', 'Install media inspection tools']);

test('original terminal CI outcomes and the zero-checkpoint phone attempt remain incomplete', () => {
  validateFlowCheckRecoveryEvidence(fileURLToPath(new URL('..', import.meta.url)), childPhoneStartupAttempt);
});

test('all 111 original workload steps retain their exact commands, environments, IDs and multiplicity', () => {
  const rows = ['smoke', 'people-safety'].flatMap(key => workflow.jobs[key].steps)
    .filter(step => step.run && !setup.has(step.name) && step.name !== 'Validate complete smoke partitioning' &&
      step.name !== 'Test child contact discovery through verified-parent approval')
    .map(step => JSON.stringify(step)).sort();
  // Semantic workload fingerprint captured from pushed pre-split source 82662bd.
  assert.equal(rows.length, 111);
  assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    '9cd670feeb2b0fa303212bd460b0f647499dac6264ad0830468354575dcbb1a2');
  const added = workflow.jobs['people-safety'].steps.filter(step => step.name === 'Test child contact discovery through verified-parent approval');
  assert.equal(added.length, 1);
  assert.equal(added[0].run, 'npm run test:child-account-approval && node --test tests/child-contact-discovery.test.mjs');
  assert.equal(added[0].env.SGM_LOCAL_FLOW_OUTPUT, '${{ runner.temp }}/child-contact-discovery.json');
});

test('service groups use separate runners and build their own unchanged backend before testing', () => {
  assert.equal(workflow.jobs.smoke['timeout-minutes'], 30);
  assert.equal(workflow.jobs['people-safety']['timeout-minutes'], 20);
  for (const key of ['smoke', 'people-safety']) {
    const job = workflow.jobs[key];
    assert.equal(job.needs, undefined); assert.equal(job['runs-on'], 'ubuntu-latest');
    assert.deepEqual(job.permissions, { contents: 'read' });
    const install = job.steps.findIndex(step => step.run === 'npm ci');
    const build = job.steps.findIndex(step => step.run === 'npm run build --workspace functions');
    assert(install >= 0 && build > install);
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      assert.notEqual(step.if, 'false');
    }
  }
});

test('all nine original and one discovery evidence uploads follow their owning tests', () => {
  const names = [];
  for (const key of ['smoke', 'people-safety']) {
    const steps = workflow.jobs[key].steps;
    const uploads = steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
    assert(steps.indexOf(uploads[0]) > steps.findLastIndex(step => step.run));
    for (const step of uploads) {
      names.push(step.with.name); assert.match(step.if, /^always\(\)/);
      if (step.with.name === 'team-club-identity-results') {
        assert(steps.some(row => row.id === 'team_club_identity'));
        assert.equal(step.with['if-no-files-found'], 'error');
      }
      if (step.with.name === 'ledger-history-services') assert(steps.some(row => row.env?.SGM_LOCAL_FLOW_OUTPUT?.endsWith('/ledger-history-services.json')));
    }
  }
  assert.equal(names.length, 10); assert.equal(new Set(names).size, 10);
  assert(names.includes('child-contact-discovery-results'));
});

test('the unchanged required check only succeeds after both complete groups succeed', () => {
  const gate = workflow.jobs['integration-gate'];
  assert.equal(gate.name, 'Functions, admin, and website smoke');
  assert.equal(gate.if, '${{ always() }}'); assert.deepEqual(gate.needs, ['smoke', 'people-safety']);
  assert.deepEqual(gate.permissions, { contents: 'read' }); assert.equal(gate.steps.length, 1);
  const step = gate.steps[0];
  assert.equal(step.env.SMOKE_RESULT, '${{ needs.smoke.result }}');
  assert.equal(step.env.PEOPLE_RESULT, '${{ needs.people-safety.result }}');
  for (const smoke of ['success', 'failure', 'cancelled', 'skipped', ''])
    for (const people of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const result = spawnSync('/bin/sh', ['-c', step.run], { env: { SMOKE_RESULT: smoke, PEOPLE_RESULT: people } });
      assert.equal(result.status === 0, smoke === 'success' && people === 'success');
    }
});

test('every CI caller of the structured PR check installs the locked YAML dependency first', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  assert.equal(pkg.devDependencies.yaml, lock.packages['node_modules/yaml'].version);
  assert.equal(lock.packages[''].devDependencies.yaml, pkg.devDependencies.yaml);
  const readiness = parseDocument(readFileSync(new URL('../.github/workflows/release-readiness.yml', import.meta.url), 'utf8')).toJSON();
  for (const source of [workflow, readiness]) {
    for (const job of Object.values(source.jobs)) {
      const checker = job.steps?.findIndex(step => step.run?.includes('npm run test:pr-user-flow-checks')) ?? -1;
      if (checker < 0) continue;
      const install = job.steps.findIndex(step => step.run === 'npm ci');
      assert(install >= 0 && install < checker);
    }
  }
});
